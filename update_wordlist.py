# pip install python-Levenshtein pybktree
# Использование:  python update_wordlist.py [wordlist.txt] [newWords.txt]
# Для русского:   python update_wordlist.py wordlist_ru.txt newWords.txt
import sys
import Levenshtein
from pybktree import BKTree
from collections import defaultdict

WORDLIST = sys.argv[1] if len(sys.argv) > 1 else 'wordlist.txt'
NEWWORDS = sys.argv[2] if len(sys.argv) > 2 else 'newWords.txt'

# --- load & merge (UTF-8 обязательно для кириллицы) ---------------------------
with open(WORDLIST, encoding='utf-8') as f:
    wordlist = set(w.strip().lower().replace('ё', 'е') for w in f if w.strip())
with open(NEWWORDS, encoding='utf-8') as f:
    wordlist.update(w.strip().lower().replace('ё', 'е') for w in f if w.strip())

# --- bucket by length ---------------------------------------------------------
buckets = defaultdict(list)
for w in wordlist:
    buckets[len(w)].append(w)

# --- helpers ------------------------------------------------------------------
def neighbor_counts_bktree(words):
    tree = BKTree(Levenshtein.distance, words)
    return {w: len(tree.find(w, 1)) - 1 for w in words}

def neighbor_counts_naive(words):
    return {w: sum(Levenshtein.distance(w, o) == 1 for o in words if o != w)
            for w in words}

# --- sort ---------------------------------------------------------------------
THRESHOLD = 2_000          # switch to BK-tree when the bucket is large
final = []

for length in sorted(buckets):
    group = buckets[length]
    if len(group) > THRESHOLD:
        counts = neighbor_counts_bktree(group)
    else:
        counts = neighbor_counts_naive(group)

    group.sort(key=lambda w: (-counts[w], w))     # most neighbors → first
    final.extend(group)

# --- write back ---------------------------------------------------------------
with open(WORDLIST, 'w', encoding='utf-8') as f:
    f.write('\n'.join(final))
