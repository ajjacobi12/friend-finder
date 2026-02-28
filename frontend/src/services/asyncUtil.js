import { validate, desanitize } from '../services/validation';

export const runAsyncAction = async (action, { 
    schema = null,
    data = null,
    setLoading, 
    setErrorMsg,
    onSuccess,
}) => {
    // validation
    if (schema) {
        const result = validate(schema, data);
        //failure
        if (!result.success) {
            if (setErrorMsg) setErrorMsg(result.error);
            return { success: false, error: result.error };
        }
        // success
        data = result.data;
    }

    // set called states
    if (setLoading) setLoading(true);
    if (setErrorMsg) setErrorMsg("");

    try {
        const response = await action;
        // if onSuccess is indicated as needed to be called, do such
        if (onSuccess) onSuccess(response);
        return { success: true, data: result };
    } catch (err) {
        if (setErrorMsg) setErrorMsg(err.message);
        return { success: false, error: err.message};
    } finally {
        if (setLoading) setLoading(false);
    }
};