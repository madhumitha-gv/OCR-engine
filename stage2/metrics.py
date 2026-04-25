"""
metrics.py
----------
Computes compression quality statistics.
No external libraries used.

Three metrics are reported:

  1. Compression Ratio
     ─────────────────
     original_bits / compressed_bits
     A ratio > 1.0 means the data got smaller.
     A ratio < 1.0 means it got bigger (happens with short or very diverse input).

  2. Entropy  (Shannon Entropy)
     ──────────────────────────
     The theoretical MINIMUM average bits needed per symbol, given the
     symbol frequencies in the input.

     Formula:  H = -Σ  p(x) * log2( p(x) )
                   all symbols x

     where p(x) = count(x) / total_symbols.

     This is the "floor" — no lossless algorithm can do better on average
     for a given symbol distribution.

  3. Encoding Efficiency
     ────────────────────
     How close did our compressed output get to the theoretical minimum?

     efficiency = (entropy / actual_avg_bits_per_symbol) * 100  (%)

     100 % = perfect (achieved the Shannon entropy floor).
     < 100 % = we used more bits than the minimum.
"""


def _log2(x):
    """Natural log via series; converted to log base 2.  No math import."""
    if x <= 0:
        return 0.0
    # Use the identity: log2(x) = ln(x) / ln(2)
    # ln(x) computed as ln(1 + (x-1)) via the series
    # For stability we use: ln(x) = 2*atanh((x-1)/(x+1))
    # atanh(z) = z + z^3/3 + z^5/5 + ...  converges for |z| < 1
    z   = (x - 1.0) / (x + 1.0)
    z2  = z * z
    ln_x = 0.0
    term = z
    for k in range(1, 200, 2):          # enough terms for float precision
        ln_x += term / k
        term *= z2
    ln_x *= 2.0
    ln_2  = 0.6931471805599453          # pre-computed constant: ln(2)
    return ln_x / ln_2


def compute_metrics(original_text, compressed_bits):
    """
    Parameters
    ----------
    original_text   : str or bytes   — the text before compression
    compressed_bits : str            — the raw bit-string produced by the encoder

    Returns
    -------
    dict with keys:
        original_chars          int
        original_bits           int
        compressed_bits_count   int
        compression_ratio       float
        entropy_bits_per_symbol float
        actual_bits_per_symbol  float
        encoding_efficiency_pct float
        space_saving_pct        float
    """
    if isinstance(original_text, str):
        raw = original_text.encode('utf-8')
    else:
        raw = original_text

    n = len(raw)
    if n == 0:
        return {"error": "Empty input — no metrics to compute."}

    # ── symbol frequency table ───────────────────────────────────────────────
    freq = {}
    for byte in raw:
        freq[byte] = freq.get(byte, 0) + 1

    # ── Shannon entropy ──────────────────────────────────────────────────────
    entropy = 0.0
    for count in freq.values():
        p = count / n
        entropy -= p * _log2(p)        # H = -Σ p * log2(p)

    # ── compressed size ──────────────────────────────────────────────────────
    comp_bits = len(compressed_bits)

    # ── bits per symbol (actual) ─────────────────────────────────────────────
    actual_bps = comp_bits / n

    # ── efficiency ───────────────────────────────────────────────────────────
    efficiency = (entropy / actual_bps * 100) if actual_bps > 0 else 0.0

    # ── compression ratio & space saving ─────────────────────────────────────
    original_bits = n * 8
    ratio         = original_bits / comp_bits if comp_bits > 0 else 0.0
    space_saving  = (1 - comp_bits / original_bits) * 100

    return {
        "original_chars":          n,
        "original_bits":           original_bits,
        "compressed_bits_count":   comp_bits,
        "compression_ratio":       round(ratio, 4),
        "entropy_bits_per_symbol": round(entropy, 4),
        "actual_bits_per_symbol":  round(actual_bps, 4),
        "encoding_efficiency_pct": round(efficiency, 2),
        "space_saving_pct":        round(space_saving, 2),
    }
