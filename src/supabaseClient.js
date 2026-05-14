import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://ueurqszqmoramxgrgicv.supabase.co";
const supabaseAnonKey = "sb_publishable_WFsFnu-FWYAV_HJl4GVYIA_og5MWHyx";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
