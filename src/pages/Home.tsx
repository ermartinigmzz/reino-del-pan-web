import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { supabase } from "../lib/supabaseClient";
import * as musicMetadata from "music-metadata-browser";

// ── INTERFACES Y CONFIGURACIONES ESTÁTICAS ──────────────────────────

interface RegionWeather {
  id: string;
  region: string;
  ciudad: string;
  lat: number;
  lon: number;
  bgGradient: string;
  temp?: string;
  clima?: string;
  icon?: string;
  maxMin?: string;
}

interface SupabaseNewsItem {
  id: string;
  type: "main" | "secondary";
  category: string;
  title: string;
  summary?: string;
  time_label: string;
  img_url: string;
  created_at: string;
}

interface MarketQuote {
  price: number;
  change: number;
}

interface MarketData {
  ibex: MarketQuote;
  nikkei: MarketQuote;
  panex: MarketQuote;
  loading: boolean;
}

interface Song {
  id: number;
  title: string;
  artist: string;
  src: string;
  cover: string | null;
  startTime?: number; // En segundos
  endTime?: number;   // En segundos
}

// Configuración base de rutas e intervalos de reproducción
const SONGS_FILES = [
  {
    id: 1,
    src: "/canciones/1.mp3",
    startTime: 30, // Minuto/segundo de inicio
    endTime: 90,   // Minuto/segundo de fin
  },
  {
    id: 2,
    src: "/canciones/2.mp3",
  },
  {
    id: 3,
    src: "/canciones/3.mp3",
  },
];

const NEWS_ITEMS = [
  "El sistema de generación de DPIs está totalmente operativo",
  "Se abre la convocatoria para tres grandes concursos de diseño: los billetes de Panedas, la identidad visual de TVP y la línea evolutiva de un Pokémon",
  "FELIZ PRIMER AÑO DEL REINO DEL PAN, A POR EL SEGUNDO"
];

const STATS_ITEMS = [
  { stat: "Más de 1 Año", title: "Desde su fundación", desc: "Iniciado como una visión el 23 de julio de 2025, ahora es un estado consolidado." },
  { stat: "500+", title: "Solicitudes de DPI", desc: "Ciudadanos digitales registrados y activos en nuestra plataforma global." },
  { stat: "100%", title: "Por la Libertad", desc: "Compromiso total con la libertad y la resiliencia de nuestro pueblo." },
  { stat: "⚠️", title: "Última Hora", desc: "Las fronteras estarán cerradas hasta nuevo aviso." }
];

const LOCAL_NEWS_FALLBACK = {
  main: {
    category: "POLÍTICA",
    title: "Cargando noticias principales...",
    summary: "Conectando con el servidor central de TVP para obtener las últimas actualizaciones del Reino...",
    time: "Ahora",
    img: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?q=80&w=800&auto=format&fit=crop"
  },
  secondary: [
    { id: "n1", category: "INFO", title: "Actualizando boletines informativos secundarios...", time: "En línea", img: "https://images.unsplash.com/photo-1504370805625-d32c54b16100?q=80&w=400&auto=format&fit=crop" },
    { id: "n2", category: "INFO", title: "Conectando con la parrilla de TVP Play...", time: "En línea", img: "https://images.unsplash.com/photo-1518063319789-7217e6706b04?q=80&w=400&auto=format&fit=crop" }
  ]
};

const REGIONES_CONFIG: RegionWeather[] = [
  { id: "baguette", region: "Baguette 🥖", ciudad: "Pantopía", lat: 37.3828, lon: -5.9732, bgGradient: "from-amber-500/20 via-orange-600/10 to-transparent" },
  { id: "pimbo", region: "Pimbo 🍞", ciudad: "Pimbolandia", lat: 40.9688, lon: -5.6639, bgGradient: "from-blue-400/10 via-slate-500/5 to-transparent" },
  { id: "pretzel", region: "Pretzel 🥨", ciudad: "Pretzelopolis", lat: 39.4698, lon: -0.3763, bgGradient: "from-sky-400/15 via-blue-500/5 to-transparent" },
  { id: "croissant", region: "Croissant 🥐", ciudad: "Vila Croissant", lat: 43.4832, lon: -1.5586, bgGradient: "from-indigo-500/15 via-slate-600/10 to-transparent" },
  { id: "singluten", region: "Sin Glúten 🌾", ciudad: "ChinPan", lat: 34.0522, lon: -118.2437, bgGradient: "from-zinc-400/20 via-neutral-700/5 to-transparent" },
  { id: "panplano", region: "Pan Plano/Arepa 🫓", ciudad: "Arepa", lat: -34.6037, lon: -58.3816, bgGradient: "from-red-600/15 via-blue-900/10 to-transparent" }
];

const getWeatherStatus = (code: number) => {
  if ([0].includes(code)) return { texto: "Despejado", icon: "☀️" };
  if ([1, 2, 3].includes(code)) return { texto: "Parcialmente Nublado", icon: "⛅" };
  if ([45, 48].includes(code)) return { texto: "Niebla", icon: "🌫️" };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { texto: "Lluvia", icon: "🌧️" };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { texto: "Nieve", icon: "❄️" };
  if ([95, 96, 99].includes(code)) return { texto: "Tormenta eléctrica", icon: "⛈️" };
  return { texto: "Variable", icon: "🌤️" };
};

// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────

export default function Home() {
  const [mainNews, setMainNews] = useState(LOCAL_NEWS_FALLBACK.main);
  const [secondaryNews, setSecondaryNews] = useState(LOCAL_NEWS_FALLBACK.secondary);

  const [weatherData, setWeatherData] = useState<RegionWeather[]>([]);
  const [weatherLoading, setWeatherLoading] = useState<boolean>(true);

  // Estados de Canciones y Música
  const [songs, setSongs] = useState<Song[]>([
    { id: 1, title: "Cargando canción 1...", artist: "Cargando...", src: "/canciones/1.mp3", cover: null, startTime: 30, endTime: 190 },
    { id: 2, title: "Cargando canción 2...", artist: "Cargando...", src: "/canciones/2.m4a", cover: null },
    { id: 3, title: "Cargando canción 3...", artist: "Cargando...", src: "/canciones/3.mp3", cover: null },
  ]);

  const [currentSong, setCurrentSong] = useState<Song>(songs[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [markets, setMarkets] = useState<MarketData>({
    ibex: { price: 11420.50, change: +0.45 },
    nikkei: { price: 38820.10, change: -0.12 },
    panex: { price: 11420.50 + 2019, change: +0.45 },
    loading: true
  });

  // Configuración de metadatos y fallbacks
  const METADATA_TIMEOUT_MS = 100;

  const SONGS_FILES = [
    {
      id: 1,
      src: "/canciones/1.mp3",
      startTime: 30,
      endTime: 190,
      fallbackTitle: "Sin Explicacion3s",
      fallbackArtist: "Dellafuente",
      fallbackCover: "/canciones/1.jpg",
      timeoutMs: 2000,
    },
    {
      id: 2,
      src: "/canciones/2.m4a",
      fallbackTitle: "Perro",
      fallbackArtist: "Bad Gyal y Victor Mendivil",
      fallbackCover: "/canciones/2.avif",
    },
    {
      id: 3,
      src: "/canciones/3.mp3",
      fallbackTitle: "Conexión",
      fallbackArtist: "Cano y JC Reyes",
      fallbackCover: "/canciones/3.jpg",
    },
  ];

  // Lectura de metadatos con Timeout y Fallback personalizado
  useEffect(() => {
    async function loadAudioMetadata() {
      const loadedSongs = await Promise.all(
        SONGS_FILES.map(async (file) => {
          const timeoutMs = file.timeoutMs || METADATA_TIMEOUT_MS;

          // Promesa de timeout
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout de ${timeoutMs}ms al leer metadatos`)), timeoutMs)
          );

          // Estructura por defecto con tus fallbacks
          const fallbackData = {
            id: file.id,
            title: file.fallbackTitle || `Pista ${file.id}`,
            artist: file.fallbackArtist || "Reino del Pan",
            src: file.src,
            cover: file.fallbackCover || null,
            startTime: file.startTime,
            endTime: file.endTime,
          };

          try {
            const metadata = await Promise.race([
              musicMetadata.fetchFromUrl(file.src),
              timeoutPromise
            ]);

            const { title, artist, picture } = metadata.common;

            let coverUrl: string | null = null;
            if (picture && picture.length > 0) {
              const pic = picture[0];
              const uint8Array = new Uint8Array(pic.data);
              const blob = new Blob([uint8Array], { type: pic.format });
              coverUrl = URL.createObjectURL(blob);
            }

            return {
              ...fallbackData,
              title: title || fallbackData.title,
              artist: artist || fallbackData.artist,
              cover: coverUrl || fallbackData.cover,
            };
          } catch (error) {
            console.warn(`Aplicado fallback para ${file.src}:`, error);
            return fallbackData;
          }
        })
      );

      setSongs(loadedSongs);

      // Sincronizar la canción actual si es la que estaba cargando para actualizar el título/carátula en pantalla
      setCurrentSong((prev) => {
        const updated = loadedSongs.find((s) => s.id === prev.id);
        return updated || loadedSongs[0];
      });
    }

    loadAudioMetadata();
  }, []);

  // Control de reproducción de audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (currentSong.startTime !== undefined) {
      audio.currentTime = currentSong.startTime;
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  }, [currentSong.id]); // Solo se ejecuta si cambia de ID de canción (evita reinicios al refrescar metadatos)



  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };
  // Estados adicionales para la barra de progreso y reproducción completa
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playFullSong, PlayFullSong] = useState<boolean>(false);

  // Formateador de segundos a mm:ss
  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Handler al cambiar la barra de progreso
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Obtenemos la duración total cuando se carga el archivo de audio
  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  // Actualización del manejador del tiempo del reproductor
  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    setCurrentTime(audio.currentTime);

    // Si no está activado el modo "Reproducir Completa", se aplica el corte
    if (!playFullSong && currentSong.id === 1 && currentSong.endTime !== undefined) {
      if (audio.currentTime >= currentSong.endTime) {
        audio.pause();
        setIsPlaying(false);
      }
    }
  };

  // Obtener datos bursátiles
  useEffect(() => {
    async function fetchMarkets() {
      try {
        const res = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols=^IBEX,^N225");
        const data = await res.json();
        const quotes = data?.quoteResponse?.result;

        if (quotes && quotes.length >= 2) {
          const ibexQuote = quotes.find((q: any) => q.symbol === "^IBEX");
          const nikkeiQuote = quotes.find((q: any) => q.symbol === "^N225");

          const ibexPrice = ibexQuote?.regularMarketPrice || 11420.50;
          const ibexChange = ibexQuote?.regularMarketChangePercent || 0.45;
          const nikkeiPrice = nikkeiQuote?.regularMarketPrice || 38820.10;
          const nikkeiChange = nikkeiQuote?.regularMarketChangePercent || -0.12;

          setMarkets({
            ibex: { price: ibexPrice, change: ibexChange },
            nikkei: { price: nikkeiPrice, change: nikkeiChange },
            panex: { price: ibexPrice + 2019, change: ibexChange },
            loading: false
          });
        } else {
          setMarkets(prev => ({ ...prev, loading: false }));
        }
      } catch (err) {
        console.warn("Usando estimación de bolsa en vivo:", err);
        setMarkets(prev => ({ ...prev, loading: false }));
      }
    }

    fetchMarkets();
    const marketInterval = setInterval(fetchMarkets, 60000);
    return () => clearInterval(marketInterval);
  }, []);

  // Carga de Supabase y Clima
  useEffect(() => {
    let isMounted = true;

    async function fetchSupabaseNews() {
      try {
        if (!supabase) return;

        const { data, error } = await supabase
          .from('tvp_news')
          .select('id, type, category, title, summary, time_label, img_url')
          .order('created_at', { ascending: false })
          .limit(15);

        if (error) throw error;

        if (data && data.length > 0 && isMounted) {
          const typedData = data as SupabaseNewsItem[];

          const supabaseMain = typedData.find((n) => n.type === 'main');
          if (supabaseMain) {
            setMainNews({
              category: supabaseMain.category,
              title: supabaseMain.title,
              summary: supabaseMain.summary || '',
              time: supabaseMain.time_label,
              img: supabaseMain.img_url
            });
          }

          const supabaseSecondaries = typedData.filter((n) => n.type === 'secondary');
          if (supabaseSecondaries.length > 0) {
            setSecondaryNews(supabaseSecondaries.slice(0, 2).map((n) => ({
              id: n.id,
              category: n.category,
              title: n.title,
              time: n.time_label,
              img: n.img_url
            })));
          }
        }
      } catch (err) {
        console.warn("Error al extraer noticias de Supabase:", err);
      }
    }

    const fetchWeather = async () => {
      try {
        const lats = REGIONES_CONFIG.map(r => r.lat).join(',');
        const lons = REGIONES_CONFIG.map(r => r.lon).join(',');

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
        const res = await fetch(url);
        const data = await res.json();

        const resultados = REGIONES_CONFIG.map((reg, index) => {
          const locationData = data[index];
          const infoClima = getWeatherStatus(locationData.current.weather_code);

          return {
            ...reg,
            temp: `${Math.round(locationData.current.temperature_2m)}°C`,
            clima: infoClima.texto,
            icon: infoClima.icon,
            maxMin: `Máx: ${Math.round(locationData.daily.temperature_2m_max[0])}° Mín: ${Math.round(locationData.daily.temperature_2m_min[0])}°`,
          };
        });

        if (isMounted) {
          setWeatherData(resultados);
          setWeatherLoading(false);
        }
      } catch (error) {
        console.error("Error al sincronizar con el satélite meteorológico:", error);
      }
    };

    fetchSupabaseNews();
    fetchWeather();

    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleNewsClick = (title: string) => {
    alert(`Abriendo emisión / artículo de TVP: \n"${title}"`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col relative overflow-x-hidden antialiased">
      <Header />

      {/* ── BANNER DE NOTICIAS ────────────────── */}
      <div
        className="w-full bg-accent text-accent-foreground border-y border-accent/20 py-2.5 overflow-hidden select-none z-20 shadow-sm"
        role="region"
        aria-label="Banner de noticias en tiempo real"
      >
        <div className="w-max flex whitespace-nowrap gap-12 animate-[marquee_35s_linear_infinite] hover:[animation-play-state:paused] cursor-pointer will-change-transform [transform:translateZ(0)]">
          <div className="flex shrink-0 items-center gap-12">
            {NEWS_ITEMS.map((item, index) => (
              <div key={`news-1-${index}`} className="flex items-center gap-4 text-xs font-mono uppercase tracking-[0.2em]">
                <span className="text-[9px] bg-accent-foreground/20 px-2 py-0.5 rounded-full" aria-hidden="true">★</span>
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-12" aria-hidden="true">
            {NEWS_ITEMS.map((item, index) => (
              <div key={`news-2-${index}`} className="flex items-center gap-4 text-xs font-mono uppercase tracking-[0.2em]">
                <span className="text-[9px] bg-accent-foreground/20 px-2 py-0.5 rounded-full">★</span>
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── HERO CON VÍDEO DE FONDO ───────────────────────────────────────── */}
      <main className="flex-1 relative flex items-center justify-center min-h-[calc(100vh-120px)] lg:min-h-0 py-12 sm:py-16 lg:py-24 px-4 sm:px-6">
        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
          <video
            autoPlay
            loop
            muted
            playsInline
            poster="/videos/hero-poster.jpg"
            className="w-full h-full object-cover object-center scale-[1.01] brightness-[0.85] contrast-[1.05]"
          >
            <source src="/videos/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/80 lg:bg-gradient-to-r lg:from-black/90 lg:via-black/50 lg:to-transparent" />
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[0.5px]" />
        </div>

        <div className="container mx-auto grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center z-10 relative">
          <div className="p-6 sm:p-8 lg:p-0 rounded-3xl bg-black/20 lg:bg-transparent backdrop-blur-md lg:backdrop-blur-none border border-white/5 lg:border-none shadow-2xl lg:shadow-none">
            <span className="text-xs uppercase tracking-[0.35em] text-accent font-bold bg-black/40 backdrop-blur-md border border-white/10 px-4 py-1.5 rounded-full inline-block shadow-sm">
              Gobierno Oficial
            </span>

            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-[3.5rem] font-black leading-[1.1] tracking-tight text-white drop-shadow-md">
              Nuestra tierra.<br />
              Nuestra gente.<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent via-blue-600 to-blue-950 filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                Reino del Pan
              </span>
            </h1>

            <div className="mt-5 w-16 h-0.5 bg-accent rounded-full" />

            <p className="mt-5 max-w-lg text-[15px] sm:text-base leading-7 text-white/90 font-medium drop-shadow-sm">
              Un estado digital y territorial dedicado a la paz, la reconciliación social, la ecología activa y la
              gobernanza del siglo XXI. Sé parte de la construcción de una nueva nación soberana.
            </p>

            <div className="mt-8 flex gap-4 flex-wrap">
              <Link
                href="/about"
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-neutral-900 transition-all duration-300 hover:bg-neutral-200 hover:shadow-lg hover:shadow-black/20 active:scale-95"
              >
                Conocer más
              </Link>
              <Link
                href="/dpi"
                className="inline-flex items-center justify-center rounded-full border-2 border-accent bg-accent px-6 py-3.5 text-xs font-bold uppercase tracking-[0.18em] text-accent-foreground transition-all duration-300 hover:bg-accent/90 hover:border-accent/90 hover:shadow-lg hover:shadow-accent/20 active:scale-95"
              >
                Obtener DPI
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {STATS_ITEMS.map(({ stat, title, desc }) => (
              <section
                key={stat}
                className="rounded-[30px] border border-white/10 bg-black/50 backdrop-blur-md p-6 transition-all duration-300 hover:-translate-y-1 hover:border-accent/60 hover:bg-black/60 shadow-lg group"
              >
                <p className="text-xs uppercase tracking-[0.3em] text-accent font-bold group-hover:translate-x-1 transition-transform duration-300 inline-block">
                  {stat}
                </p>
                <h2 className="mt-2 text-[25px] font-bold leading-snug text-white">
                  {title}
                </h2>
                <p className="mt-2 text-[13px] text-white/70 leading-relaxed font-normal">
                  {desc}
                </p>
              </section>
            ))}
          </div>
        </div>
      </main>

      {/* ── MÚSICA & BOLSAS DE VALORES ── */}
      <section className="w-full bg-[#0b0c10] border-t border-b border-white/10 py-12 px-4 sm:px-6">
        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">

          {/* LADO IZQUIERDO: TOP 50 REINO DEL PAN (SPOTIFY STYLE) */}
          <div className="bg-[#12141d] rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
            <audio
              ref={audioRef}
              src={currentSong.src}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
            />

            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase tracking-[0.2em] text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Top 50 • Reino del Pan
                </span>
                <span className="text-xs text-white/40 font-mono">TOP 3 + 🔊</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-4 flex items-center gap-2">
                <span>Éxitos en Pantopía</span>
              </h3>

              {/* Lista de Canciones */}
              <div className="space-y-3">
                {songs.map((song) => {
                  const isSelected = currentSong.id === song.id;
                  return (
                    <div
                      key={song.id}
                      onClick={() => {
                        setCurrentSong(song);
                        setIsPlaying(true);
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl cursor-pointer transition-all duration-200 border ${isSelected
                        ? "bg-emerald-500/10 border-emerald-500/40 text-white"
                        : "bg-white/5 border-transparent text-white/70 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-sm font-bold opacity-60 w-4 text-center">
                          #{song.id}
                        </span>
                        <div className="w-10 h-10 rounded-xl bg-neutral-800 overflow-hidden flex items-center justify-center shrink-0 border border-white/10">
                          {song.cover ? (
                            <img src={song.cover} alt={song.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base">🎵</span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold leading-tight">{song.title}</p>
                          <p className="text-xs opacity-60 mt-0.5">{song.artist}</p>
                        </div>
                      </div>

                      {isSelected && isPlaying ? (
                        <span className="text-xs font-mono text-emerald-400 font-bold animate-pulse">
                          ▶
                        </span>
                      ) : (
                        <span className="text-xs font-mono text-white/40">
                          ▶?
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Controles del Reproductor + Barra de Progresión */}
            <div className="mt-6 pt-4 border-t border-white/10 space-y-3">
              {/* Línea de Progresión */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-white/50">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="w-11 h-11 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center hover:bg-emerald-400 transition-transform active:scale-95 shadow-lg shadow-emerald-500/20 shrink-0"
                  >
                    {isPlaying ? "⏸" : "▶"}
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white leading-tight truncate">
                      {currentSong.title}
                    </p>
                    <p className="text-[11px] text-white/50 truncate">
                      {currentSong.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Botón Opción Canción Completa / Recorte */}
                  {currentSong.startTime !== undefined && (
                    <button
                      onClick={() => PlayFullSong(!playFullSong)}
                      className={`text-[10px] font-mono px-2.5 py-1 rounded-xl border transition-all ${playFullSong
                        ? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
                        : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                        }`}
                    >
                      {playFullSong ? "🔀" : "✂️"}
                    </button>
                  )}

                  {/* Bandera del Reino del Pan */}
                  <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded-xl shrink-0">
                    <img
                      src="/flag.png"
                      alt="Bandera del Reino del Pan"
                      className="w-5 h-3.5 object-cover rounded shadow-sm"
                      onError={(e) => { e.currentTarget.style.display = 'none'; }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* LADO DERECHO: MERCADOS EN TIEMPO REAL */}
          <div className="bg-[#12141d] rounded-3xl p-6 sm:p-8 border border-white/10 flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs uppercase tracking-[0.3em] text-blue-400 font-bold bg-blue-500/10 border border-blue-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                  Mercados Financieros
                </span>
                <span className="text-xs text-white/40 font-mono">En tiempo real</span>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-6">
                Índices Bursátiles
              </h3>

              {/* Grid de Cotizaciones */}
              <div className="space-y-4">
                {/* PANEX 75 */}
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/40 rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden">
                  <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-amber-500/10 rounded-full blur-xl pointer-events-none"></div>
                  <div>
                    <span className="text-xs text-amber-400 uppercase font-mono tracking-wider font-bold">
                      Reino del Pan ★
                    </span>
                    <h4 className="text-base font-black text-amber-300">PANEX 75</h4>
                  </div>
                  <div className="text-right z-10">
                    <p className="text-xl font-mono font-black text-amber-400">
                      {markets.panex.price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className={`text-xs font-mono font-bold ${markets.panex.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {markets.panex.change >= 0 ? "+" : ""}{markets.panex.change.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* IBEX 35 */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <span className="text-xs text-white/50 uppercase font-mono tracking-wider">España</span>
                    <h4 className="text-base font-bold text-white">IBEX 35</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-bold text-white">
                      {markets.ibex.price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className={`text-xs font-mono font-bold ${markets.ibex.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {markets.ibex.change >= 0 ? "+" : ""}{markets.ibex.change.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* NIKKEI 225 */}
                <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:border-white/10 transition-colors">
                  <div>
                    <span className="text-xs text-white/50 uppercase font-mono tracking-wider">Japón</span>
                    <h4 className="text-base font-bold text-white">Nikkei 225</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-mono font-bold text-white">
                      {markets.nikkei.price.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <span className={`text-xs font-mono font-bold ${markets.nikkei.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {markets.nikkei.change >= 0 ? "+" : ""}{markets.nikkei.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-white/10 flex justify-between items-center text-[11px] text-white/40">
              <span>Sincronizado con bolsa central</span>
              <span className="font-mono">Actualizado hace instantes</span>
            </div>
          </div>

        </div>
      </section>

      {/* ── SECCIÓN: ANUNCIO INSTITUCIONAL COMPLETO ── */}
      <section className="w-full">
        <img
          src="/anunciosgov/seguimosavanzando.jpg"
          alt="Anuncio Institucional: Seguimos Avanzando"
          loading="lazy"
          className="w-full h-auto block"
        />
      </section>

      {/* ── SECCIÓN METEOROLÓGICA DEL REINO ── */}
      <section className="w-full bg-neutral-950 py-16 px-4 sm:px-6 border-t border-white/5">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
            <div>
              <span className="text-xs uppercase tracking-[0.3em] text-accent font-bold block mb-2">
                Servicio Meteorológico Nacional
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Estado del Clima en el Reino
              </h2>
            </div>
            <p className="text-xs text-white/50 max-w-xs md:text-right font-medium">
              Datos reales medidos por satélite para la gobernanza territorial del Reino del Pan.
            </p>
          </div>

          {weatherLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse h-44 rounded-[24px] bg-neutral-900/50 border border-white/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {weatherData.map((item) => (
                <div
                  key={item.id}
                  className={`relative overflow-hidden rounded-[24px] border border-white/10 bg-gradient-to-br ${item.bgGradient} bg-neutral-900/40 backdrop-blur-xl p-6 flex flex-col justify-between h-44 transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-neutral-900/60 shadow-md group`}
                >
                  <div className="flex justify-between items-start z-10">
                    <div>
                      <span className="text-[11px] font-bold tracking-widest uppercase text-white/40 block mb-0.5">
                        Región {item.region}
                      </span>
                      <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-accent transition-colors duration-300">
                        {item.ciudad}
                      </h3>
                    </div>
                    <span className="text-3xl filter drop-shadow-sm select-none">{item.icon}</span>
                  </div>

                  <div className="flex justify-between items-end z-10">
                    <div>
                      <p className="text-xs font-semibold text-white/80">{item.clima}</p>
                      <p className="text-[11px] text-white/50 mt-0.5 font-medium">{item.maxMin}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-5xl font-light tracking-tighter text-white">
                        {item.temp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── SECCIÓN: CONTENEDOR INTEGRADO CON FONDO BLANCO AZULADO (#CDCCD4) ── */}
      <section className="w-full px-4 sm:px-6 py-16 lg:py-24 bg-[#CDCCD4]">
        <div className="container mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Tarjeta Laboral Panian Bank */}
          <div className="rounded-[32px] bg-white p-8 sm:p-10 flex flex-col justify-between shadow-xl min-h-[380px] group transition-all duration-300 border border-black/5">
            <div>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs uppercase tracking-[0.25em] text-neutral-600 font-bold bg-neutral-100 px-4 py-1.5 rounded-full">
                  Alianza Financiera
                </span>
                <img
                  src="/LK.png"
                  alt="Laboral Kutxa"
                  loading="lazy"
                  className="h-6 w-auto object-contain opacity-90 group-hover:opacity-100 transition-opacity mix-blend-multiply"
                />
              </div>
              <h3 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight text-neutral-950">
                Laboral Panian Bank
              </h3>
              <p className="mt-4 text-[14px] sm:text-base text-neutral-700 leading-relaxed font-normal">
                El Gobierno del Reino del Pan y Laboral Kutxa han alcanzado un acuerdo para la creación de Laboral Panian Bank.
                Una nueva entidad identidad financiera que impulsará el ahorro, la inversión y el crecimiento económico del país.
                El futuro de la banca paniense comienza hoy.
              </p>
            </div>
            <div className="mt-8 flex items-center">
              <span className="text-xs uppercase tracking-[0.15em] font-mono font-bold text-emerald-800/90">Se une a nosotros para crear la primera entidad financiera del Reino del Pan</span>
            </div>
          </div>

          {/* Tarjeta PKMN */}
          <div className="rounded-[32px] bg-white p-8 sm:p-10 grid grid-cols-1 sm:grid-cols-[1.2fr_0.8fr] gap-6 items-center shadow-xl min-h-[380px] group transition-all duration-300 border border-black/5">
            <div className="flex flex-col justify-between h-full">
              <div>
                <span className="text-xs uppercase tracking-[0.25em] text-amber-800 font-bold bg-amber-50 px-4 py-1.5 rounded-full inline-block">
                  Descubrimiento PKMN
                </span>
                <h3 className="mt-6 text-2xl sm:text-3xl font-black tracking-tight text-neutral-950">
                  Tercer Inicial Revelado
                </h3>
                <p className="mt-4 text-[14px] sm:text-base text-neutral-700 leading-relaxed font-normal">
                  Cyndaquil es oficialmente el tercer inicial anunciado para el ecosistema del Reino. Su naturaleza y capacidades marcarán el inicio de una nueva era de exploración.
                </p>
              </div>
              <div className="mt-8 sm:mt-0">
                <span className="text-xs uppercase tracking-[0.15em] font-mono font-bold text-amber-800/90">Especie registrada ★</span>
              </div>
            </div>
            <div className="flex justify-center items-center h-full max-h-[220px] sm:max-h-full">
              <img
                src="/pkmn/cyndaquil.png"
                alt="cyndaquil inicial"
                loading="lazy"
                className="max-h-[180px] sm:max-h-[220px] w-auto object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.06)] group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ── SECCIÓN: CONCURSOS OFICIALES ── */}
      <section className="w-full px-4 sm:px-6 py-24 mt-8 bg-[#07080c] relative overflow-hidden select-none border-t border-white/5">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-72 bg-accent/5 rounded-full blur-[140px] pointer-events-none" />

        <div className="container mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-16">
            <span className="text-xs uppercase tracking-[0.4em] text-accent font-bold block mb-3 animate-pulse">
              Convocatorias Abiertas
            </span>
            <h2 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-md">
              Concursos del Reino
            </h2>
            <p className="text-sm text-white/40 mt-6 max-w-2xl mx-auto font-medium">
              Participa activamente en la construcción de la identidad de nuestra nación. Inscríbete en las convocatorias oficiales, aporta tus ideas y deja tu huella en el ecosistema digital del Reino del Pan.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {/* Concurso 1: Paneda */}
            <Link href="/concursos/paneda" className="group block">
              <div className="bg-[#0e1017] rounded-3xl p-8 sm:p-10 border border-white/5 hover:border-amber-500/40 transition-all duration-300 shadow-xl hover:shadow-amber-500/10 h-full flex flex-col hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-amber-500/5 rounded-full blur-[40px] group-hover:bg-amber-500/10 transition-colors"></div>
                <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform relative z-10">
                  🪙
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 group-hover:text-amber-400 transition-colors relative z-10">
                  Diseño de la Paneda
                </h3>
                <p className="text-sm text-white/50 leading-relaxed flex-1 relative z-10">
                  Da forma a nuestra economía soberana. Diseña los billetes oficiales y la identidad visual que respaldará nuestras finanzas.
                </p>
                <div className="mt-8 flex items-center text-xs font-black uppercase tracking-[0.15em] text-amber-500 relative z-10">
                  Ver bases y participar <span className="ml-2 group-hover:translate-x-1.5 transition-transform">→</span>
                </div>
              </div>
            </Link>

            {/* Concurso 2: Línea Evolutiva */}
            <Link href="/concursos/lineapoke" className="group block">
              <div className="bg-[#0e1017] rounded-3xl p-8 sm:p-10 border border-white/5 hover:border-blue-500/40 transition-all duration-300 shadow-xl hover:shadow-blue-500/10 h-full flex flex-col hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/5 rounded-full blur-[40px] group-hover:bg-blue-500/10 transition-colors"></div>
                <div className="w-14 h-14 bg-blue-500/10 text-blue-500 rounded-2xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 group-hover:-rotate-6 transition-transform relative z-10">
                  🧬
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 group-hover:text-blue-400 transition-colors relative z-10">
                  Línea Evolutiva
                </h3>
                <p className="text-sm text-white/50 leading-relaxed flex-1 relative z-10">
                  Expande la biodiversidad de nuestras fronteras. Conceptualiza y crea una nueva línea evolutiva completa para el ecosistema.
                </p>
                <div className="mt-8 flex items-center text-xs font-black uppercase tracking-[0.15em] text-blue-500 relative z-10">
                  Ver bases y participar <span className="ml-2 group-hover:translate-x-1.5 transition-transform">→</span>
                </div>
              </div>
            </Link>

            {/* Concurso 3: Imagen TVP */}
            <Link href="/concursos/imagentvp" className="group block">
              <div className="bg-[#0e1017] rounded-3xl p-8 sm:p-10 border border-white/5 hover:border-[#ff4d00]/40 transition-all duration-300 shadow-xl hover:shadow-[#ff4d00]/10 h-full flex flex-col hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-[#ff4d00]/5 rounded-full blur-[40px] group-hover:bg-[#ff4d00]/10 transition-colors"></div>
                <div className="w-14 h-14 bg-[#ff4d00]/10 text-[#ff4d00] rounded-2xl flex items-center justify-center text-3xl mb-8 group-hover:scale-110 group-hover:rotate-6 transition-transform relative z-10">
                  📺
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-3 group-hover:text-[#ff4d00] transition-colors relative z-10">
                  Imagen Visual TVP
                </h3>
                <p className="text-sm text-white/50 leading-relaxed flex-1 relative z-10">
                  Lidera la revolución de nuestros medios. Renueva la identidad corporativa y el paquete gráfico de los programas oficiales.
                </p>
                <div className="mt-8 flex items-center text-xs font-black uppercase tracking-[0.15em] text-[#ff4d00] relative z-10">
                  Ver bases y participar <span className="ml-2 group-hover:translate-x-1.5 transition-transform">→</span>
                </div>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* ── SECCIÓN: TARJETA TVP NOTICIAS ── */}
      <section className="w-full px-4 sm:px-6 mt-8 max-w-7xl mx-auto z-10">
        <div className="w-full bg-[#07080c] text-white rounded-3xl overflow-hidden border border-white/5 p-6 sm:p-8 md:p-10 shadow-2xl flex flex-col gap-10 font-tvp-text selection:bg-[#ff4d00]">

          {/* Header del Módulo TVP */}
          <div className="flex items-center justify-between border-b border-white/10 pb-6">
            <div className="flex items-center gap-4">
              <img src="/TVP/TVP.png" alt="TVP" loading="lazy" className="h-7 md:h-8 object-contain select-none" />
              <div className="h-5 w-[1px] bg-white/20"></div>
              <h3 className="font-tvp-head text-base md:text-xl font-bold tracking-widest uppercase text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-[#ff4d00] rounded-full animate-ping"></span>
              </h3>
            </div>
            <Link href="/tvp">
              <span className="text-xs text-[#ff4d00] cursor-pointer hover:underline uppercase tracking-[0.25em] font-bold font-tvp-head transition-all">
                Portal Play →
              </span>
            </Link>
          </div>

          {/* Grid de Noticias de Supabase */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-12">

            {/* Noticia Principal */}
            <div
              onClick={() => handleNewsClick(mainNews.title)}
              className="lg:col-span-2 group cursor-pointer bg-[#0e1017] rounded-2xl overflow-hidden border border-white/5 hover:border-[#ff4d00]/30 transition-all duration-300 shadow-xl flex flex-col justify-between"
            >
              <div className="relative w-full aspect-video overflow-hidden">
                <img src={mainNews.img} alt={mainNews.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-500" />
                <span className="absolute top-4 left-4 bg-[#ff4d00] text-black text-[10px] sm:text-xs font-black px-4 py-2 rounded font-tvp-head tracking-[0.2em] uppercase shadow-md">
                  {mainNews.category}
                </span>
              </div>

              <div className="p-8 sm:p-10 md:p-12 flex flex-col gap-8 flex-1 justify-between">
                <div className="flex flex-col gap-6">
                  <span className="text-[11px] text-white/40 tracking-[0.25em] uppercase font-semibold font-mono">{mainNews.time}</span>
                  <h3 className="font-tvp-head text-2xl sm:text-3xl md:text-4xl font-black text-white group-hover:text-[#ff4d00] transition-colors tracking-[0.06em] leading-[1.6]">
                    {mainNews.title}
                  </h3>
                  <p className="text-sm sm:text-base text-neutral-400 font-light tracking-[0.05em] leading-[1.9] mt-2">
                    {mainNews.summary}
                  </p>
                </div>
              </div>
            </div>

            {/* Noticias Secundarias */}
            <div className="flex flex-col gap-5 justify-between">
              {secondaryNews.map((sn) => (
                <div
                  key={sn.id}
                  onClick={() => handleNewsClick(sn.title)}
                  className="group cursor-pointer bg-[#0e1017] rounded-2xl overflow-hidden border border-white/5 hover:border-[#ff4d00]/20 transition-all duration-300 shadow-md flex flex-col h-full justify-between"
                >
                  <div className="relative w-full aspect-video overflow-hidden shrink-0">
                    <img src={sn.img} alt={sn.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-[1.015] transition-transform duration-500" />
                    <span className="absolute top-3 left-3 bg-[#0a0b10]/95 backdrop-blur text-white text-[9px] font-bold px-3 py-1.5 rounded tracking-[0.2em] uppercase font-tvp-head border border-white/5">
                      {sn.category}
                    </span>
                  </div>

                  <div className="p-10 flex flex-col gap-10 flex-1 justify-center">
                    <span className="text-[10px] text-white/40 font-medium tracking-[0.2em] font-mono">{sn.time}</span>
                    <h4 className="font-tvp-head font-bold text-base sm:text-xl text-white/90 group-hover:text-[#ff4d00] transition-colors tracking-[0.07em] leading-[1.7]">
                      {sn.title}
                    </h4>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      <Footer />

      <style dangerouslySetInnerHTML={{
        __html: `
      @font-face {
          font-family: 'TVP-Heading';
          src: url('/TVP/TVP.ttf') format('truetype');
          font-weight: bold;
      }
      @font-face {
          font-family: 'TVP-Text';
          src: url('/TVP/TVPtext.ttf') format('truetype');
          font-weight: normal;
      }
      .font-tvp-head { font-family: 'TVP-Heading', sans-serif; }
      .font-tvp-text { font-family: 'TVP-Text', sans-serif; }
    `}} />

      <style>{`
      @keyframes marquee {
        0% {
          transform: translate3d(0, 0, 0);
        }
        100% {
          transform: translate3d(-50%, 0, 0);
        }
      }

      .custom-marquee {
        animation: marquee 35s linear infinite !important;
      }

      .custom-marquee:hover {
        animation-play-state: paused !important;
      }
    `}</style>
    </div>
  );
}