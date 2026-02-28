// validation.js
// ensures data is correct type and format

import { z } from 'zod';

// ------------------------- SCHEMAS -----------------------

// ------- USER SPECIFIC -----------
// user UUID: 
export const userUUIDSchema = z.string().uuid();

// sessionID: 6 characters, uppercase, alphanumeric
export const SessionIDSchema = z.string()
    .length(6)
    .toUpperCase()
    .regex(/^[A-Z0-9]+$/);

// User Profile: name: 1-15 characters, hex color, and privacy settings
export const UserProfileSchema = z.object({
    name: z.string().min(1).max(15).trim(),
    color: z.string().regex(/^#[0-9A-F]{6}$/i).default('#cccccc'),
    // isGhost: z.boolean().optional().default(false),
    // fineLocation: z.boolean().optional().default(true),
});

// ------- CHAT SPECIFIC -----------
// chatRoomID: 6 char sessionID or UUID_UUID
export const DMPattern = z.string().regex(/^[a-f0-9-]{36}_[a-f0-9-]{36}$/i); // UUID_UUID
export const ChatRoomIDSchema = z.union([SessionIDSchema, DMPattern]);

// messageID: uuid
export const msgIDSchema = z.string().uuid();

// Chat Messages: no empty strings, max 500 characters
export const MessageTextSchema = z.string().min(1).max(500).trim();

// message context: contains text; isEncrypted is boolean, default = false; version default = "1.0"
export const MessageContextSchema = z.object({
    text: MessageTextSchema,
    isEncrypted: z.boolean().default(false),
    version: z.string().regex(/^[0-9.]+$/).default("1.0")
});

// --- EXPORTED HELPERS ---
// returns { success: true } or { success: false, error }
// different than dataCleaner since it doesn't use safeParse, which returns only null if false 
// this gives a reason why so that the user knows
export const validate = (schema, inputData) => {
    const result = schema.safeParse(inputData);

    if(!result.success) {
        return {
            success: false,
            error: result.error.issues[0].message
        };
    }

    return {
        success: true,
        data: result.data
    };
}; 

// desanitization
export const desanitize = (str) => {
    if (!str || typeof str !== 'string') return "";
    const map = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'"
    };

    // This regex looks for any of the keys in our map and replaces them
    return str.replace(/&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (match) => map[match]);
};