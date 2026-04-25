"""
huffman.py
----------
Pure-Python Adaptive Huffman Coding using the FGK algorithm.
No external libraries used anywhere in this file.

Used by app.py — do not run this file directly.
"""


# =============================================================================
# NODE
# Each box in our tree is a Node.
# =============================================================================

class Node:
    """
    One node in the adaptive Huffman tree.

    symbol  → the byte value this leaf represents (None for internal nodes)
    weight  → how many times this symbol has appeared so far
    order   → a number used to keep the tree ordered correctly
    is_nyt  → True only for the special "Not Yet Transmitted" sentinel node
    """

    def __init__(self, symbol=None, weight=0, order=0, is_nyt=False):
        self.symbol = symbol
        self.weight = weight
        self.order  = order
        self.is_nyt = is_nyt
        self.left   = None   # 0-branch
        self.right  = None   # 1-branch
        self.parent = None

    def is_leaf(self):
        return self.left is None and self.right is None


# =============================================================================
# TREE
# The live adaptive tree — shared logic used by both encoder and decoder.
# =============================================================================

class AdaptiveHuffmanTree:
    """
    Maintains the FGK adaptive Huffman tree.

    Both the encoder and decoder each create their own copy of this tree
    and call update() after every symbol.  Because the updates are identical,
    both trees always look the same — no need to transmit the tree.
    """

    MAX_ORDER = 1024   # safe upper bound for an 8-bit (256-symbol) alphabet

    def __init__(self):
        # Start with a single NYT node that IS the root
        self.nyt  = Node(is_nyt=True, order=self.MAX_ORDER)
        self.root = self.nyt

        self._all_nodes   = [self.nyt]   # flat list of every node (for swapping)
        self._sym_to_leaf = {}           # symbol (int) → its leaf node

    # ── public helpers ──────────────────────────────────────────────────────

    def has_symbol(self, sym):
        return sym in self._sym_to_leaf

    def get_code(self, node):
        """Walk from node up to root, collecting 0s and 1s, then reverse."""
        bits = []
        cur  = node
        while cur.parent is not None:
            # Left child → '0', right child → '1'
            bits.append('0' if cur.parent.left is cur else '1')
            cur = cur.parent
        bits.reverse()
        return ''.join(bits)

    def nyt_code(self):
        return self.get_code(self.nyt)

    # ── update (called after every symbol) ──────────────────────────────────

    def update(self, symbol):
        """
        If symbol is new: grow the tree by splitting NYT.
        Then restore the sibling property bottom-up.
        """
        if symbol not in self._sym_to_leaf:
            self._expand_nyt(symbol)
        self._slide_and_increment(self._sym_to_leaf[symbol])

    # ── private ─────────────────────────────────────────────────────────────

    def _expand_nyt(self, symbol):
        """
        Split the current NYT node into:
          left  = new NYT  (takes over the NYT role)
          right = new leaf (for the new symbol)
        The old NYT becomes an ordinary internal node.
        """
        old_nyt = self.nyt
        o = old_nyt.order

        new_nyt  = Node(is_nyt=True, order=o - 2, weight=0)
        new_leaf = Node(symbol=symbol,  order=o - 1, weight=0)

        old_nyt.is_nyt = False
        old_nyt.left   = new_nyt
        old_nyt.right  = new_leaf
        new_nyt.parent  = old_nyt
        new_leaf.parent = old_nyt

        self._all_nodes.append(new_nyt)
        self._all_nodes.append(new_leaf)
        self._sym_to_leaf[symbol] = new_leaf
        self.nyt = new_nyt

    def _block_leader(self, node):
        """
        Find the highest-order node with the same weight as `node`
        (excluding `node` itself and its parent — swapping with a parent
        would break the tree structure).
        """
        leader = node
        for n in self._all_nodes:
            if n is node or n is node.parent:
                continue
            if n.weight == node.weight and n.order > leader.order:
                leader = n
        return leader

    def _swap(self, a, b):
        """
        Swap the POSITIONS of two nodes in the tree.
        Their weights and subtrees stay with them — only parent/child
        links and order numbers are exchanged.
        """
        if a is b or a is b.parent or b is a.parent:
            return

        pa, pb = a.parent, b.parent

        if pa.left is a:
            pa.left = b
        else:
            pa.right = b

        if pb.left is b:
            pb.left = a
        else:
            pb.right = a

        a.parent, b.parent = pb, pa
        a.order,  b.order  = b.order, a.order

    def _slide_and_increment(self, node):
        """
        Walk upward from `node` to root.
        At each step: swap with block leader if needed, then increment weight.
        """
        while node is not None:
            leader = self._block_leader(node)
            if leader is not node:
                self._swap(node, leader)
            node.weight += 1
            node = node.parent


    def get_tree_visualization(self):
        """Return tree structure as nested dict for frontend visualization."""
        def node_to_dict(node):
            if node.is_leaf():
                return {
                    "type": "leaf",
                    "symbol": node.symbol,
                    "weight": node.weight,
                    "code": self.get_code(node) if node.symbol is not None else "",
                    "char": chr(node.symbol) if node.symbol is not None and 32 <= node.symbol <= 126 else f"\\x{node.symbol:02x}" if node.symbol is not None else ""
                }
            else:
                return {
                    "type": "internal",
                    "weight": node.weight,
                    "left": node_to_dict(node.left) if node.left else None,
                    "right": node_to_dict(node.right) if node.right else None
                }

        return node_to_dict(self.root)


# =============================================================================
# ENCODER
# =============================================================================

class AdaptiveHuffmanEncoder:
    """
    Encodes bytes into a bit-string using the FGK adaptive Huffman algorithm.

    For each byte:
      - If FIRST OCCURRENCE  → emit the current NYT code + 8-bit raw value
      - If SEEN BEFORE       → emit the symbol's current tree code
    Then update the tree (which the decoder will mirror).
    """

    def __init__(self):
        self._tree = AdaptiveHuffmanTree()

    def encode(self, data):
        """
        data: bytes or str
        Returns: bit-string (a plain Python string of '0's and '1's)
        """
        if isinstance(data, str):
            data = data.encode('utf-8')

        out = []
        for byte in data:
            if self._tree.has_symbol(byte):
                # Seen before — use tree code
                out.append(self._tree.get_code(self._tree._sym_to_leaf[byte]))
            else:
                # New symbol — NYT prefix + 8-bit literal
                out.append(self._tree.nyt_code())
                out.append(format(byte, '08b'))
            self._tree.update(byte)

        return ''.join(out)

    @staticmethod
    def pack(bits):
        """
        Turn a bit-string into real bytes for storage/transmission.
        Prepends a single header byte recording how many padding bits were added.
        """
        pad  = (8 - len(bits) % 8) % 8
        bits = bits + '0' * pad
        header = bytes([pad])
        body   = bytes(int(bits[i:i+8], 2) for i in range(0, len(bits), 8))
        return header + body


# =============================================================================
# DECODER
# =============================================================================

class AdaptiveHuffmanDecoder:
    """
    Mirrors the encoder exactly — maintains an identical tree and reads
    one symbol at a time by following the tree from root to leaf.
    """

    def __init__(self):
        self._tree = AdaptiveHuffmanTree()

    def decode(self, bits, num_symbols=None):
        """
        bits:        bit-string
        num_symbols: how many symbols to decode (prevents consuming padding)
        Returns:     bytes
        """
        result  = []
        i       = 0
        decoded = 0

        while i < len(bits):
            if num_symbols is not None and decoded >= num_symbols:
                break

            cur = self._tree.root

            while True:
                if cur.is_nyt:
                    # Read 8-bit literal
                    if i + 8 > len(bits):
                        return bytes(result)
                    symbol = int(bits[i:i+8], 2)
                    i += 8
                    break

                if cur.is_leaf():
                    symbol = cur.symbol
                    break

                # Consume one bit to descend
                if i >= len(bits):
                    return bytes(result)
                bit = bits[i]; i += 1
                cur = cur.left if bit == '0' else cur.right

            result.append(symbol)
            decoded += 1
            self._tree.update(symbol)

        return bytes(result)

    @staticmethod
    def unpack(data):
        """
        Reverse of pack(): strip the header byte and remove padding bits.
        Returns the bit-string.
        """
        pad  = data[0]
        body = data[1:]
        bits = ''.join(format(b, '08b') for b in body)
        return bits[:len(bits) - pad] if pad else bits
