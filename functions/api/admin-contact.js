import { json, handleOptions, getAdminSetting } from '../_lib.js';

export const onRequestOptions = () => handleOptions();

export async function onRequestGet({ env }) {
    const email = await getAdminSetting(env.DB, 'admin_email', '');
    return json({ email });
}
