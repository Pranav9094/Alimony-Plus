// Check a file's leading bytes against the MIME type the client declared.
export const ALLOWED_MIME = [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const startsWith = (buf, bytes) => bytes.every((b, i) => buf[i] === b);

export const matchesDeclaredType = (buffer, mime) => {
    if (!buffer || buffer.length < 8) return false;
    switch (mime) {
        case "application/pdf": return startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]);
        case "image/png": return startsWith(buffer, [0x89, 0x50, 0x4e, 0x47]);
        case "image/jpeg": return startsWith(buffer, [0xff, 0xd8, 0xff]);
        case "application/msword": return startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0]);
        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            return startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]);
        default: return false;
    }
};
