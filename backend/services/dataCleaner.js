// dataCleaner.js
// ensures data is correct type and format

const { z } = require('zod');
const DOMPurify = require('isomorphic-dompurify');

// --- HELPERS ---
// sanitization
const sanitizeStrict = (val) => {
    if (!val || typeof val !== 'string') return "";
    return DOMPurify.sanitize(val, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true
    }).trim();
};

// ------------------------- SCHEMAS -----------------------

// ------- USER SPECIFIC -----------
// user UUID: 
const userUUIDSchema = z.string().uuid();

// sessionID: 6 characters, uppercase, alphanumeric
const SessionIDSchema = z.string()
    .length(6)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/);

// User Profile: name: 1-15 characters, hex color, and privacy settings
const UserProfileSchema = z.object({
    name: z.string().min(1).max(15).transform(sanitizeStrict),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#cccccc'),
    // isGhost: z.boolean().optional().default(false),
    // fineLocation: z.boolean().optional().default(true),
});

// ------- CHAT SPECIFIC -----------
// chatRoomID: 6 char sessionID or UUID_UUID
const DMPattern = z.string().regex(/^[a-f0-9-]{36}_[a-f0-9-]{36}$/i); // UUID_UUID
const ChatRoomIDSchema = z.union([SessionIDSchema, DMPattern]);

// messageID: uuid
const msgIDSchema = z.string().uuid();

// Chat Messages: no empty strings, max 500 characters
const msgTextSchema = z.string().min(1).max(500).transform(sanitizeStrict);

// message context: contains text; isEncrypted is boolean, default = false; version default = "1.0"
const msgContextSchema = z.object({
    text: msgTextSchema,
    isEncrypted: z.boolean().default(false),
    version: z.string().regex(/^[0-9.]+$/).default("1.0")
});

// --- EXPORTED CLEANER ---
const clean = {
    // ---- user specific ----
    userUUID: (id) => {
        const result = userUUIDSchema.safeParse(id);
        return result.success ? result.data : null;
    },

    sessionID: (id) => {
        const result = SessionIDSchema.safeParse(id);
        return result.success ? result.data : null;
    },

    userProfile: (data) => {
        const result = UserProfileSchema.safeParse(data);
        return result.success ? result.data : null;
    },

    // ---- chat specific ----
    chatRoom: (id) => {
        const result = ChatRoomIDSchema.safeParse(id);
        return result.success ? result.data : null;
    },

    msgID: (id) => {
        const result = msgIDSchema.safeParse(id);
        return result.success ? result.data : null;
    },

    msgText: (msg) => {
        const result = msgTextSchema.safeParse(msg);
        return result.success ? result.data : null;
    },

    msgContext: (msgContext) => {
        const result = msgContextSchema.safeParse(msgContext);
        return result.success ? result.data : null;
    },
};

module.exports = clean;