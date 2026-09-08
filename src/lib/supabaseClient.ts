import { createClient } from '@supabase/supabase-js';

// 1. Diagnóstico de variables de entorno en Vite
console.log("--- DIAGNÓSTICO DE VITE ---");
console.log("Todo el objeto env:", import.meta.env);
console.log("URL detectada:", import.meta.env.VITE_SUPABASE_URL);
console.log("---------------------------");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    "Faltan las variables de entorno de Supabase. " +
    "Asegúrate de tener un archivo .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY"
  );
}

// 2. Cliente con fallback para evitar que la app crashee completamente al arrancar
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);