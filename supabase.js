const SUPABASE_URL =
'https://uzbbwvihkfzdbnowhglc.supabase.co';

const SUPABASE_ANON_KEY =
'sb_publishable_a6YEwdDOpkZ6BI8pHXVPnQ_WlFMlHmf';

const sb =
supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);

window.ledgerSB = sb;
