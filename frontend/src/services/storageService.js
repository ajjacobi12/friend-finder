// frontend/services/storageService.js
// remembers userUUID and sessionID so user can "re-introduce" itself to server middleware after being closed
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = { 
    USER_IDENTITY: 'user_identity', // UUID + sessionID
    USER_PREFS: 'user_prefs' // name + color
 }; // store object as JSON

export const storageService = {
    // save objects
    saveIdentity: async (identity) => {
        try {
            const jsonValue = JSON.stringify(identity);
            await AsyncStorage.setItem(KEYS.USER_IDENTITY, jsonValue);
        } catch (err) {
            console.error('Error saving identity:', err);
        }
    },

    savePrefs: async (prefs) => {
        try {
            const jsonValue = JSON.stringify(prefs);
            await AsyncStorage.setItem(KEYS.USER_PREFS, jsonValue);
        } catch (err) {
            console.error('Error saving prefs.');
        }
    },

    // load objects
    loadIdentity: async () => {
        try {
            const jsonValue = await AsyncStorage.getItem(KEYS.USER_IDENTITY);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (err) {
            console.error('Error loading identity: ', err);
            return null
        }
    },

    loadPrefs: async () => {
        try {
            const jsonValue = await AsyncStorage.getItem(KEYS.USER_PREFS);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (err) {
            console.error('Error loading prefs: ', err);
            return null
        }
    },

    // clear everything (for handleCleanExit)
    clearIdentity: async () => {
        try {
            await AsyncStorage.removeItem(KEYS.USER_IDENTITY);
        } catch (err) {
            console.error('Error clearing identity: ', err);
        }
    },

    clearPrefs: async () => {
        try {
            await AsyncStorage.removeItem(KEYS.USER_PREFS);
        } catch (err) {
            console.error('Error clearing identity: ', err);
        }
    }
};