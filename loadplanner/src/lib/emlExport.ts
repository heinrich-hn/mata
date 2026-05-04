/**
 * Build an RFC 822 .eml message with a PDF attachment and trigger a browser download.
 *
 * Outlook (and most desktop mail clients) will open the downloaded .eml file as a
 * draft with the attachment already attached, allowing the user to review and send.
 *
 * This is the only reliable cross-platform way to "auto-attach" a file to an email
 * from a web app — `mailto:` URLs cannot carry attachments by spec, and most modern
 * Outlook builds also strip the body from `mailto:` links above a few hundred bytes.
 */

interface BuildEmlOptions {
    to: string;
    /** Optional comma-separated CC list */
    cc?: string;
    subject: string;
    body: string;
    /** PDF bytes encoded as base64 (no data: prefix) */
    pdfBase64: string;
    pdfFileName: string;
    /** Optional From header (purely cosmetic — the user's mail client controls the actual sender) */
    from?: string;
}

/**
 * Wrap a long base64 string into 76-char lines as required by RFC 2045.
 */
function wrapBase64(b64: string, width = 76): string {
    const lines: string[] = [];
    for (let i = 0; i < b64.length; i += width) {
        lines.push(b64.slice(i, i + width));
    }
    return lines.join("\r\n");
}

/**
 * Encode a header value containing non-ASCII characters using RFC 2047 (Q-encoding).
 */
function encodeHeader(value: string): string {
    // Fast path: pure ASCII printable
    if (/^[\x20-\x7E]*$/.test(value)) return value;
    const utf8 = unescape(encodeURIComponent(value));
    let out = "";
    for (const ch of utf8) {
        const code = ch.charCodeAt(0);
        if (ch === " ") out += "_";
        else if (ch === "=" || ch === "?" || ch === "_" || code < 0x20 || code > 0x7e) {
            out += "=" + code.toString(16).toUpperCase().padStart(2, "0");
        } else {
            out += ch;
        }
    }
    return `=?UTF-8?Q?${out}?=`;
}

/**
 * Build the .eml file contents.
 */
export function buildEmlMessage({
    to,
    cc,
    subject,
    body,
    pdfBase64,
    pdfFileName,
    from,
}: BuildEmlOptions): string {
    const boundary = `----=_Mata_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 10)}`;
    const date = new Date().toUTCString();

    const headers = [
        `Date: ${date}`,
        from ? `From: ${encodeHeader(from)}` : null,
        `To: ${to}`,
        cc && cc.trim() ? `Cc: ${cc}` : null,
        `Subject: ${encodeHeader(subject)}`,
        `MIME-Version: 1.0`,
        `Content-Type: multipart/mixed; boundary="${boundary}"`,
        `X-Unsent: 1`, // tells Outlook to open as a draft
    ].filter(Boolean);

    const safeBody = body.replace(/\r?\n/g, "\r\n");

    const parts = [
        // Text body
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        `Content-Transfer-Encoding: 8bit`,
        ``,
        safeBody,
        ``,
        // PDF attachment
        `--${boundary}`,
        `Content-Type: application/pdf; name="${pdfFileName}"`,
        `Content-Transfer-Encoding: base64`,
        `Content-Disposition: attachment; filename="${pdfFileName}"`,
        ``,
        wrapBase64(pdfBase64),
        ``,
        `--${boundary}--`,
        ``,
    ];

    return headers.join("\r\n") + "\r\n\r\n" + parts.join("\r\n");
}

/**
 * Build the .eml message and trigger a browser download.
 * The user double-clicks the downloaded file → opens in Outlook as a draft with the PDF attached.
 */
export function downloadEmlWithAttachment(options: BuildEmlOptions & { fileName?: string }): void {
    const eml = buildEmlMessage(options);
    const safeName = (options.fileName || options.subject || "draft").replace(/[^\w\-. ]+/g, "_").slice(0, 80);
    const blob = new Blob([eml], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeName}.eml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
