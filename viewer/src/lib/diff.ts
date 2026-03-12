export interface DiffSegment {
  text: string;
  type: "equal" | "added" | "removed";
}

/**
 * Word-level diff using LCS (Longest Common Subsequence).
 */
export function wordDiff(a: string, b: string): DiffSegment[] {
  const wordsA = tokenize(a);
  const wordsB = tokenize(b);

  const lcs = computeLCS(wordsA, wordsB);

  const result: DiffSegment[] = [];
  let ia = 0;
  let ib = 0;
  let il = 0;

  while (il < lcs.length) {
    // Emit removed words from A before the next LCS match
    while (ia < wordsA.length && wordsA[ia] !== lcs[il]) {
      push(result, wordsA[ia], "removed");
      ia++;
    }
    // Emit added words from B before the next LCS match
    while (ib < wordsB.length && wordsB[ib] !== lcs[il]) {
      push(result, wordsB[ib], "added");
      ib++;
    }
    // Emit the matching word
    push(result, lcs[il], "equal");
    ia++;
    ib++;
    il++;
  }

  // Remaining words
  while (ia < wordsA.length) {
    push(result, wordsA[ia], "removed");
    ia++;
  }
  while (ib < wordsB.length) {
    push(result, wordsB[ib], "added");
    ib++;
  }

  return result;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function push(result: DiffSegment[], text: string, type: DiffSegment["type"]) {
  const last = result[result.length - 1];
  if (last && last.type === type) {
    last.text += text;
  } else {
    result.push({ text, type });
  }
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;

  // For very long texts, limit to avoid O(m*n) blowup
  if (m * n > 1_000_000) {
    // Fall back to simple approach: just return B as "added" and A as "removed"
    return [];
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}
