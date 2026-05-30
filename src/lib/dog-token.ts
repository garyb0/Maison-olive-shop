function stripWrapping(value: string) {
  return value.trim().replace(/^["'`]+|["'`]+$/g, "");
}

function stripTokenLabel(value: string) {
  return value.replace(/^(?:qr|code|token)\s*[:#-]\s*/i, "").trim();
}

function cleanToken(value: string) {
  let token = stripTokenLabel(stripWrapping(value));
  const separatorIndex = token.search(/[?#\s]/);

  if (separatorIndex >= 0) {
    token = token.slice(0, separatorIndex);
  }

  token = token.replace(/\/+$/g, "");

  try {
    return decodeURIComponent(token);
  } catch {
    return token;
  }
}

function tokenFromUrl(value: string) {
  const candidates: string[] = [];

  if (/^https?:\/\//i.test(value)) {
    candidates.push(value);
  } else if (value.startsWith("/")) {
    candidates.push(`https://chezolive.local${value}`);
  } else if (/^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/i.test(value)) {
    candidates.push(`https://${value}`);
  }

  for (const candidate of candidates) {
    try {
      const url = new URL(candidate);
      const segments = url.pathname.split("/").filter(Boolean);
      const dogSegmentIndex = segments.findIndex((segment) => segment.toLowerCase() === "dog");
      const pathToken = dogSegmentIndex >= 0 ? segments[dogSegmentIndex + 1] : null;

      if (pathToken) {
        return cleanToken(pathToken);
      }

      const queryToken =
        url.searchParams.get("publicToken") ?? url.searchParams.get("token") ?? url.searchParams.get("qr");

      if (queryToken) {
        return cleanToken(queryToken);
      }
    } catch {
      // Fall through to the regex-based parsing below.
    }
  }

  return null;
}

export function normalizeDogPublicTokenInput(input: string) {
  const raw = stripTokenLabel(stripWrapping(input));

  if (!raw) {
    return "";
  }

  const urlToken = tokenFromUrl(raw);
  if (urlToken) {
    return urlToken;
  }

  const pathMatch = raw.match(/(?:^|\/)dog\/([^/?#\s]+)/i);
  if (pathMatch?.[1]) {
    return cleanToken(pathMatch[1]);
  }

  const queryMatch = raw.match(/[?&](?:publicToken|token|qr)=([^&#\s]+)/i);
  if (queryMatch?.[1]) {
    return cleanToken(queryMatch[1]);
  }

  return cleanToken(raw);
}
