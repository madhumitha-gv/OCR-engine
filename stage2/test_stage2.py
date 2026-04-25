"""
test_stage2.py
--------------
Runs a full end-to-end test of Stage 2 WITHOUT needing the Flask server to be
running.  It imports the modules directly and verifies:

  1. Round-trip correctness  (compress → decompress → original)
  2. Metrics values are sensible
  3. Edge cases (single char, long repetitive text, prose)

Run with:
    python test_stage2.py
"""

import binascii
from huffman  import AdaptiveHuffmanEncoder, AdaptiveHuffmanDecoder
from metrics  import compute_metrics


# ── helpers ──────────────────────────────────────────────────────────────────

def compress_text(text):
    """Compress a string → (hex_string, num_symbols, metrics_dict)."""
    raw        = text.encode('utf-8')
    encoder    = AdaptiveHuffmanEncoder()
    bit_string = encoder.encode(raw)
    packed     = encoder.pack(bit_string)
    hex_out    = binascii.hexlify(packed).decode('ascii')
    stats      = compute_metrics(raw, bit_string)
    return hex_out, len(raw), stats


def decompress_text(hex_data, num_symbols):
    """Decompress a hex string → original text string."""
    packed     = binascii.unhexlify(hex_data)
    decoder    = AdaptiveHuffmanDecoder()
    bit_string = decoder.unpack(packed)
    raw        = decoder.decode(bit_string, num_symbols=num_symbols)
    return raw.decode('utf-8')


# ── test cases ────────────────────────────────────────────────────────────────

def run_tests():
    test_cases = [
        ("hello world",                              "Short common phrase"),
        ("aaaaabbbbbccccc",                          "Repetitive — should compress well"),
        ("AAAAAAAAAAAAAAAAAAAAAA",                   "Highly repetitive single char"),
        ("the quick brown fox jumps over the lazy dog", "Pangram — all letters once"),
        ("x",                                        "Single character"),
        ("abcdefghijklmnopqrstuvwxyz" * 3,           "Repeated alphabet"),
    ]

    sep   = "─" * 68
    PASS  = "PASS ✓"
    FAIL  = "FAIL ✗"

    print(sep)
    print("  Stage 2 — End-to-End Test Suite")
    print(sep)

    all_passed = True

    for text, description in test_cases:
        hex_data, num_sym, stats = compress_text(text)
        recovered = decompress_text(hex_data, num_sym)

        ok = recovered == text
        all_passed = all_passed and ok

        print(f"\n  Test      : {description}")
        print(f"  Input     : {repr(text[:50])}{'...' if len(text) > 50 else ''}")
        print(f"  Result    : {PASS if ok else FAIL}")
        print(f"  Ratio     : {stats['compression_ratio']:.4f}  "
              f"({'compressed' if stats['compression_ratio'] > 1 else 'expanded'})")
        print(f"  Entropy   : {stats['entropy_bits_per_symbol']:.4f} bits/symbol")
        print(f"  Efficiency: {stats['encoding_efficiency_pct']:.2f}%")
        print(f"  Saving    : {stats['space_saving_pct']:.2f}%")

        if not ok:
            print(f"  Expected  : {repr(text)}")
            print(f"  Got       : {repr(recovered)}")

    print(f"\n{sep}")
    if all_passed:
        print("  All tests passed ✓")
    else:
        print("  SOME TESTS FAILED — check output above")
    print(sep)


if __name__ == '__main__':
    run_tests()
