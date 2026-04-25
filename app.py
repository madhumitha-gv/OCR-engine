"""
app.py  —  Stage 2: Adaptive Huffman Compression Microservice
Port: 8002

Endpoints
---------
  GET  /health      liveness check
  POST /compress    { "text": "..." }  →  compression result + metrics
  POST /decompress  { "compressed": "<base64>", "num_symbols": <int> }  →  { "text": "..." }
"""

import base64

from flask import Flask, request, jsonify
from flask_cors import CORS

from huffman import AdaptiveHuffmanEncoder, AdaptiveHuffmanDecoder
from metrics import compute_metrics

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


# =============================================================================
# GET /health
# =============================================================================

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "stage2-huffman", "port": 8002})


# =============================================================================
# POST /compress
# =============================================================================

@app.route('/compress', methods=['POST'])
def compress():
    """
    Request body:
        { "text": "your text here" }

    Response:
        {
          "compressed":            "<base64 string>",
          "original_size_bits":    <int>,
          "compressed_size_bits":  <int>,
          "compression_ratio":     <float>,
          "entropy":               <float>,
          "encoding_efficiency":   <float>   ← 0.0–1.0  (e.g. 0.774 = 77.4%)
        }
    """
    body = request.get_json(silent=True)
    if not body or 'text' not in body:
        return jsonify({"error": "Send JSON with a 'text' field."}), 400

    text = body['text']
    if not isinstance(text, str) or len(text) == 0:
        return jsonify({"error": "'text' must be a non-empty string."}), 400

    # Encode
    raw        = text.encode('utf-8')
    encoder    = AdaptiveHuffmanEncoder()
    bit_string = encoder.encode(raw)
    packed     = encoder.pack(bit_string)

    # Base64-encode the packed bytes for safe JSON transport
    b64 = base64.b64encode(packed).decode('ascii')

    # Metrics
    stats = compute_metrics(raw, bit_string)

    # Visualization data
    tree_viz = encoder._tree.get_tree_visualization()
    symbol_freq = {}
    for byte in raw:
        symbol_freq[byte] = symbol_freq.get(byte, 0) + 1

    return jsonify({
        "compressed":           b64,
        "original_size_bits":   stats["original_bits"],
        "compressed_size_bits": stats["compressed_bits_count"],
        "compression_ratio":    stats["compression_ratio"],
        "entropy":              stats["entropy_bits_per_symbol"],
        "encoding_efficiency":  round(stats["encoding_efficiency_pct"] / 100, 4),
        # Visualization data
        "huffman_tree":         tree_viz,
        "encoded_bits":         bit_string,
        "symbol_frequencies":   symbol_freq,
    })


# =============================================================================
# POST /decompress
# =============================================================================

@app.route('/decompress', methods=['POST'])
def decompress():
    """
    Request body:
        {
          "compressed":  "<base64 string>",
          "num_symbols": <int>
        }

    Response:
        { "text": "recovered original text" }
    """
    body = request.get_json(silent=True)
    if not body or 'compressed' not in body or 'num_symbols' not in body:
        return jsonify({
            "error": "Send JSON with 'compressed' (base64) and 'num_symbols' (int)."
        }), 400

    # Base64-decode back to bytes
    try:
        packed = base64.b64decode(body['compressed'])
    except Exception:
        return jsonify({"error": "'compressed' is not valid base64."}), 400

    num_symbols = body['num_symbols']
    if not isinstance(num_symbols, int) or num_symbols < 1:
        return jsonify({"error": "'num_symbols' must be a positive integer."}), 400

    # Decode
    decoder    = AdaptiveHuffmanDecoder()
    bit_string = decoder.unpack(packed)
    raw        = decoder.decode(bit_string, num_symbols=num_symbols)

    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError:
        return jsonify({"error": "Recovered bytes are not valid UTF-8."}), 500

    return jsonify({"text": text})


# =============================================================================
# Entry point
# =============================================================================

if __name__ == '__main__':
    print("=" * 50)
    print("  Stage 2 — Huffman Compression Microservice")
    print("  http://localhost:8002")
    print("  GET  /health")
    print("  POST /compress")
    print("  POST /decompress")
    print("=" * 50)
    app.run(host='0.0.0.0', port=8002, debug=False)