// frontend/src/core/identity/identityStorage.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = { 
    USER_IDENTITY: 'user_identity', 
    USER_PREFS: 'user_prefs' 
};

export const identityStorage = {
    save: async (key, val) => {
        try {
            await AsyncStorage.setItem(key, JSON.stringify(val))
        } catch (err) {
            console.log("[IDENTITY] error saving identity:", err.message);
        }
    },
    
    load: async (key) => {
        try{
            const val = await AsyncStorage.getItem(key);
            return val ? JSON.parse(val) : null;
        } catch (err) {
            console.log("[IDENTITY] error loading identity:", err.message);
            return null;
        }
    },

    remove: async (key) => {
        try {
            await AsyncStorage.removeItem(key)
        } catch (err) {
            console.log("[IDENTITY] error clearing identity:", err.message);
        }
    },

    clearAll: async () => {
        await identityStorage.remove(KEYS.IDENTITY);
        await identityStorage.remove(KEYS.PREFS);
    }

};