// dataCleaner.js
// ensures data is correct type and format
const { z } = require('zod');
const DOMPurify = require('isomorphic-dompurify');

// no HTML allowed at all
const sanitizeStrict = (val) => {
    if (!val) return "";
    return DOMPurify.sanitize(val, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
    }).trim();
};

// --- SCHEMAS ---

// sessionID: 6 characters, uppercase, alphanumeric
const SessionIDSchema = z.string()
    .length(6)
    .transform(val => val.toUpperCase().replace(/[^A-Z0-9]/g, ''));

// User Profile: name: 1-15 characters, hex color, and privacy settings
const UserProfileSchema = z.object({
    name: z.string().min(1).max(15).transform(sanitizeStrict),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#cccccc'),
    // isGhost: z.boolean().optional().default(false),
    // fineLocation: z.boolean().optional().default(true),
});

// Chat Messages: no empty strings, max 500 characters
const TextSchema = z.string().min(1).max(500).transform(sanitizeStrict);

const MessageContextSchema = z.object({
    text: TextSchema,
    isEncrypted: z.boolean().default(false),
    version: z.string().default("1.0").transform(sanitizeStrict)
});

// for DMS: chatRoomID is UUID_UUID
const ChatRoomIDSchema = z.string().min(6).max(100);

const msgIDSchema = z.string().uuid().optional();

// --- EXPORTED CLEANER ---
const clean = {
    // basic string cleaner for sessionIDs, names, and general text
    text: (input) => {
        if (!input || typeof input !== 'string') return '';
        // DOMPurify.sanitize returns a clean string
        return DOMPurify.sanitize(input, plainTextConfig).trim();
    },

    // must be uppercase, alphanumeric, and 6 chars
    sessionID: (id) => {
        const result = SessionIDSchema.safeParse(id);
        return result.success ? result.data : null;
    },

    userProfile: (data) => {
        const result = UserProfileSchema.safeParse(data);
        return result.success ? result.data : null;
    },

    message: (msg) => {
        const result = MessageSchema.safeParse(msg);
        return result.success ? result.data : null;
    },

    messageContext: (msgContext) => {
        const result = MessageContextSchema.safeParse(msgContext);
        return result.success ? result.data : null;
    },
    
    chatRoom: (id) => {
        const result = ChatRoomIDSchema.safeParse(id);
        return result.success ? result.data : null;
    }
};

module.exports = clean;