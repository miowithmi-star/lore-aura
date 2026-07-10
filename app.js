
const { useState, useEffect, useCallback } = React;

// ---------- SUPABASE CONFIG ----------
// Ключи берутся из config/supabase.js (подключается раньше app.js в index.html)
const SUPABASE_URL = window.SUPABASE_CONFIG.url;
const SUPABASE_ANON_KEY = window.SUPABASE_CONFIG.anonKey;
const FAKE_EMAIL_DOMAIN = window.SUPABASE_CONFIG.fakeEmailDomain;

async function authRequest(path, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error_description || data.msg || data.error || "Ошибка авторизации");
  }
  return data;
}

async function db(path, { method = "GET", body, token, prefer } = {}) {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
  };
  if (prefer) headers.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || err.hint || "Ошибка запроса к базе");
  }
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// simple storage shim (localStorage, since this now runs as a real website)
const storage = {
  get: (key) => {
    const v = localStorage.getItem(key);
    return Promise.resolve(v ? { value: v } : null);
  },
  set: (key, value) => { localStorage.setItem(key, value); return Promise.resolve({ key, value }); },
  delete: (key) => { localStorage.removeItem(key); return Promise.resolve({ key, deleted: true }); },
};

const DEFAULT_TRAITS = [
  { name: "Уютность", emoji: "☕" },
  { name: "Хаос", emoji: "🔥" },
  { name: "Интеллект", emoji: "🧠" },
  { name: "Чувство юмора", emoji: "😂" },
  { name: "Заботливость", emoji: "💌" },
];

const RARITIES = ["Common", "Rare", "Epic", "Legendary"];
const RARITY_COLORS = {
  Common: "var(--rarity-common)",
  Rare: "var(--rarity-rare)",
  Epic: "var(--rarity-epic)",
  Legendary: "var(--rarity-legendary)",
};

function cx(...arr) { return arr.filter(Boolean).join(" "); }

function Spinner({ className }) {
  return <div className={cx("inline-block animate-spin", className)}>⏳</div>;
}

// ---------- AUTH SCREEN ----------
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) { setError("Заполни логин и пароль"); return; }
    setLoading(true);
    const email = `${username.trim().toLowerCase()}@${FAKE_EMAIL_DOMAIN}`;
    try {
      if (mode === "signup") {
        const data = await authRequest("signup", { email, password });
        if (!data.access_token) throw new Error("Регистрация не вернула сессию. Проверь, что подтверждение email выключено в Supabase.");
        await db("profiles", { method: "POST", token: data.access_token, body: { id: data.user.id, username: username.trim() } });
        onAuthed({ ...data, username: username.trim() });
      } else {
        const data = await authRequest("token?grant_type=password", { email, password });
        const profiles = await db(`profiles?id=eq.${data.user.id}&select=username`, { token: data.access_token });
        onAuthed({ ...data, username: profiles?.[0]?.username || username.trim() });
      }
    } catch (err) {
      let msg = err.message;
      if (msg.includes("already registered") || msg.includes("already exists")) msg = "Такой логин уже занят";
      if (msg.includes("Invalid login")) msg = "Неверный логин или пароль";
      setError(msg);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-neutral-950 text-neutral-100 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <span className="text-2xl">✨</span>
          <h1 className="text-2xl font-semibold tracking-tight">LORE</h1>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
          <div className="flex mb-6 bg-neutral-950 rounded-xl p-1">
            <button className={cx("flex-1 py-2 rounded-lg text-sm font-medium transition", mode === "login" ? "bg-neutral-800 text-white" : "text-neutral-500")} onClick={() => setMode("login")}>Вход</button>
            <button className={cx("flex-1 py-2 rounded-lg text-sm font-medium transition", mode === "signup" ? "bg-neutral-800 text-white" : "text-neutral-500")} onClick={() => setMode("signup")}>Регистрация</button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Логин</label>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" placeholder="alina123" autoCapitalize="none" />
            </div>
            <div>
              <label className="text-xs text-neutral-400 mb-1 block">Пароль</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" placeholder="••••••••" />
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button type="submit" disabled={loading} className="w-full btn-accent font-medium rounded-lg py-2 text-sm mt-2 flex items-center justify-center gap-2 disabled:opacity-60">
              {loading && <Spinner />} {mode === "signup" ? "Создать аккаунт" : "Войти"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function RarityBadge({ rarity }) {
  return (
    <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
      style={{ color: RARITY_COLORS[rarity] || RARITY_COLORS.Common, border: `1px solid ${(RARITY_COLORS[rarity] || RARITY_COLORS.Common)}55` }}>
      {rarity}
    </span>
  );
}

function CharacterCard({ character, onClick }) {
  return (
    <button onClick={onClick} className="text-left bg-neutral-900 border border-neutral-800 rounded-2xl p-4 hover:border-neutral-600 transition flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold" style={{ background: `${(RARITY_COLORS[character.rarity] || RARITY_COLORS.Common)}22` }}>
          {character.avatar_url ? <img src={character.avatar_url} alt="" className="w-12 h-12 rounded-xl object-cover" /> : (character.name?.[0]?.toUpperCase() || "?")}
        </div>
        <RarityBadge rarity={character.rarity} />
      </div>
      <div>
        <p className="font-medium text-neutral-100">{character.name}</p>
        <p className="text-xs text-neutral-500">{character.character_class || "Без класса"}</p>
      </div>
      {character.arc && <p className="text-xs text-neutral-400 italic line-clamp-2">"{character.arc}"</p>}
    </button>
  );
}

function NewCharacterModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [characterClass, setCharacterClass] = useState("");
  const [rarity, setRarity] = useState("Common");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({ name: name.trim(), character_class: characterClass.trim(), rarity });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold">Новый персонаж</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Имя</label>
            <input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" placeholder="Алина" />
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Класс персонажа</label>
            <input value={characterClass} onChange={(e) => setCharacterClass(e.target.value)} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" placeholder="Лучший друг" />
          </div>
          <div>
            <label className="text-xs text-neutral-400 mb-1 block">Редкость</label>
            <div className="flex gap-2 flex-wrap">
              {RARITIES.map((r) => (
                <button key={r} onClick={() => setRarity(r)} className={cx("px-3 py-1.5 rounded-lg text-xs border", rarity === r ? "border-accent text-accent" : "border-neutral-800 text-neutral-400")}>{r}</button>
              ))}
            </div>
          </div>
          <button onClick={handleCreate} disabled={saving || !name.trim()} className="w-full btn-accent font-medium rounded-lg py-2 text-sm mt-2 disabled:opacity-60 flex items-center justify-center gap-2">
            {saving && <Spinner />} Создать
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ session, onOpenCharacter, onLogout, onOpenSharedSearch }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db(`characters?owner_id=eq.${session.user.id}&order=created_at.desc`, { token: session.access_token });
      setCharacters(data || []);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate({ name, character_class, rarity }) {
    try {
      const [created] = await db("characters", { method: "POST", token: session.access_token, prefer: "return=representation", body: { owner_id: session.user.id, name, character_class, rarity } });
      await db("traits", { method: "POST", token: session.access_token, body: DEFAULT_TRAITS.map((t) => ({ character_id: created.id, name: t.name, emoji: t.emoji, value: 50 })) });
      setShowNew(false);
      setCharacters((prev) => [created, ...prev]);
      onOpenCharacter(created.id);
    } catch (e) { alert("Не получилось создать персонажа: " + e.message); }
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="sticky top-0 bg-neutral-950/90 backdrop-blur border-b border-neutral-900 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-2"><span className="text-lg">✨</span><span className="font-semibold">LORE</span></div>
        <div className="flex items-center gap-3">
          <button onClick={onOpenSharedSearch} className="text-neutral-400 hover:text-neutral-200 text-sm" title="Посмотреть по коду">🔍</button>
          <span className="text-xs text-neutral-500 hidden sm:block">@{session.username}</span>
          <button onClick={onLogout} className="text-neutral-400 hover:text-neutral-200 text-sm">⎋</button>
        </div>
      </div>
      <div className="p-4 max-w-3xl mx-auto">
        <button onClick={() => setShowNew(true)} className="w-full mb-4 border border-dashed border-neutral-800 rounded-2xl py-4 flex items-center justify-center gap-2 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition">+ Новый персонаж</button>
        {loading ? (
          <div className="flex justify-center py-12"><Spinner className="text-2xl" /></div>
        ) : characters.length === 0 ? (
          <p className="text-center text-neutral-500 text-sm py-12">Пока никого нет. Добавь первого человека в свой архив.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {characters.map((c) => <CharacterCard key={c.id} character={c} onClick={() => onOpenCharacter(c.id)} />)}
          </div>
        )}
      </div>
      {showNew && <NewCharacterModal onClose={() => setShowNew(false)} onCreate={handleCreate} />}
    </div>
  );
}

function StatBar({ trait, onChange, editable }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1"><span>{trait.emoji} {trait.name}</span><span className="text-neutral-500">{trait.value}/100</span></div>
      <input type="range" min="0" max="100" value={trait.value} disabled={!editable} onChange={(e) => onChange(trait.id, Number(e.target.value))} className="w-full accent-amber-400" />
    </div>
  );
}

function LoreTab({ characterId, token, editable }) {
  const [chapters, setChapters] = useState([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await db(`chapters?character_id=eq.${characterId}&order=order_index.asc`, { token });
    setChapters(data || []); setLoading(false);
  }, [characterId, token]);
  useEffect(() => { load(); }, [load]);

  async function addChapter() {
    if (!title.trim()) return;
    const [created] = await db("chapters", { method: "POST", token, prefer: "return=representation", body: { character_id: characterId, title: title.trim(), content: content.trim(), order_index: chapters.length } });
    setChapters((p) => [...p, created]); setTitle(""); setContent("");
  }
  async function removeChapter(id) { await db(`chapters?id=eq.${id}`, { method: "DELETE", token }); setChapters((p) => p.filter((c) => c.id !== id)); }

  if (loading) return <div className="text-center mt-8"><Spinner /></div>;
  return (
    <div className="space-y-3">
      {chapters.map((c, i) => (
        <div key={c.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3">
          <div className="flex justify-between items-start gap-2">
            <p className="font-medium text-sm">📌 Глава {i + 1} — {c.title}</p>
            {editable && <button onClick={() => removeChapter(c.id)} className="text-neutral-600 hover:text-red-400">🗑</button>}
          </div>
          {c.content && <p className="text-sm text-neutral-400 mt-1 whitespace-pre-wrap">{c.content}</p>}
        </div>
      ))}
      {chapters.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">Глав пока нет.</p>}
      {editable && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 space-y-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название главы (напр. Знакомство)" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Расскажи, что произошло..." rows={3} className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600 resize-none" />
          <button onClick={addChapter} disabled={!title.trim()} className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-lg py-2 text-sm disabled:opacity-50">+ Добавить главу</button>
        </div>
      )}
    </div>
  );
}

function QuotesTab({ characterId, token, editable }) {
  const [quotes, setQuotes] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const data = await db(`quotes?character_id=eq.${characterId}&order=created_at.desc`, { token });
    setQuotes(data || []); setLoading(false);
  }, [characterId, token]);
  useEffect(() => { load(); }, [load]);
  async function addQuote() {
    if (!text.trim()) return;
    const [created] = await db("quotes", { method: "POST", token, prefer: "return=representation", body: { character_id: characterId, text: text.trim() } });
    setQuotes((p) => [created, ...p]); setText("");
  }
  async function removeQuote(id) { await db(`quotes?id=eq.${id}`, { method: "DELETE", token }); setQuotes((p) => p.filter((q) => q.id !== id)); }
  if (loading) return <div className="text-center mt-8"><Spinner /></div>;
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder='"Я не опоздала, я пришла в свою временную линию."' className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" onKeyDown={(e) => e.key === "Enter" && addQuote()} />
          <button onClick={addQuote} className="bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3">+</button>
        </div>
      )}
      {quotes.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">Цитат пока нет.</p>}
      {quotes.map((q) => (
        <div key={q.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex justify-between gap-2 items-start">
          <p className="text-sm italic text-neutral-200">"{q.text}"</p>
          {editable && <button onClick={() => removeQuote(q.id)} className="text-neutral-600 hover:text-red-400 shrink-0">🗑</button>}
        </div>
      ))}
    </div>
  );
}

function GiftsTab({ characterId, token, editable }) {
  const [gifts, setGifts] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const data = await db(`gift_memories?character_id=eq.${characterId}&order=created_at.desc`, { token });
    setGifts(data || []); setLoading(false);
  }, [characterId, token]);
  useEffect(() => { load(); }, [load]);
  async function addGift() {
    if (!text.trim()) return;
    const [created] = await db("gift_memories", { method: "POST", token, prefer: "return=representation", body: { character_id: characterId, text: text.trim() } });
    setGifts((p) => [created, ...p]); setText("");
  }
  async function toggleFulfilled(g) {
    await db(`gift_memories?id=eq.${g.id}`, { method: "PATCH", token, body: { fulfilled: !g.fulfilled } });
    setGifts((p) => p.map((x) => (x.id === g.id ? { ...x, fulfilled: !x.fulfilled } : x)));
  }
  async function removeGift(id) { await db(`gift_memories?id=eq.${id}`, { method: "DELETE", token }); setGifts((p) => p.filter((g) => g.id !== id)); }
  if (loading) return <div className="text-center mt-8"><Spinner /></div>;
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder='"Хочу попробовать хороший чай"' className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" onKeyDown={(e) => e.key === "Enter" && addGift()} />
          <button onClick={addGift} className="bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3">+</button>
        </div>
      )}
      {gifts.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">Идей для подарков пока нет.</p>}
      {gifts.map((g) => (
        <div key={g.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-3 flex items-center gap-3">
          {editable && (
            <button onClick={() => toggleFulfilled(g)} className={cx("w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-xs", g.fulfilled ? "btn-accent-solid" : "border-neutral-700")}>
              {g.fulfilled && "✓"}
            </button>
          )}
          <p className={cx("text-sm flex-1", g.fulfilled && "line-through text-neutral-500")}>{g.text}</p>
          {editable && <button onClick={() => removeGift(g.id)} className="text-neutral-600 hover:text-red-400">🗑</button>}
        </div>
      ))}
    </div>
  );
}

function TraitsTab({ characterId, token, editable }) {
  const [traits, setTraits] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const data = await db(`traits?character_id=eq.${characterId}`, { token });
    setTraits(data || []); setLoading(false);
  }, [characterId, token]);
  useEffect(() => { load(); }, [load]);
  async function commitUpdate(id, value) { await db(`traits?id=eq.${id}`, { method: "PATCH", token, body: { value } }); }
  if (loading) return <div className="text-center mt-8"><Spinner /></div>;
  return (
    <div>
      {traits.map((t) => (
        <StatBar key={t.id} trait={t} editable={editable} onChange={(id, value) => {
          setTraits((p) => p.map((x) => (x.id === id ? { ...x, value } : x)));
          commitUpdate(id, value);
        }} />
      ))}
    </div>
  );
}

function EggsTab({ characterId, token, editable }) {
  const [eggs, setEggs] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const data = await db(`easter_eggs?character_id=eq.${characterId}`, { token });
    setEggs(data || []); setLoading(false);
  }, [characterId, token]);
  useEffect(() => { load(); }, [load]);
  async function addEgg() {
    if (!text.trim()) return;
    const [created] = await db("easter_eggs", { method: "POST", token, prefer: "return=representation", body: { character_id: characterId, text: text.trim() } });
    setEggs((p) => [...p, created]); setText("");
  }
  async function removeEgg(id) { await db(`easter_eggs?id=eq.${id}`, { method: "DELETE", token }); setEggs((p) => p.filter((e) => e.id !== id)); }
  if (loading) return <div className="text-center mt-8"><Spinner /></div>;
  return (
    <div className="space-y-3">
      {editable && (
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="любит запах дождя" className="flex-1 bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" onKeyDown={(e) => e.key === "Enter" && addEgg()} />
          <button onClick={addEgg} className="bg-neutral-800 hover:bg-neutral-700 rounded-lg px-3">+</button>
        </div>
      )}
      {eggs.length === 0 && <p className="text-sm text-neutral-500 text-center py-6">Пасхалок пока нет.</p>}
      <div className="flex flex-wrap gap-2">
        {eggs.map((e) => (
          <span key={e.id} className="bg-neutral-900 border border-neutral-800 rounded-full px-3 py-1.5 text-xs flex items-center gap-2">
            🧩 {e.text}
            {editable && <button onClick={() => removeEgg(e.id)} className="text-neutral-600 hover:text-red-400">✕</button>}
          </span>
        ))}
      </div>
    </div>
  );
}

function IntroTab({ character, editable, onSave }) {
  const [ability, setAbility] = useState(character.intro_ability || "");
  const [weakness, setWeakness] = useState(character.intro_weakness || "");
  const [boss, setBoss] = useState(character.intro_boss || "");
  async function save() { await onSave({ intro_ability: ability, intro_weakness: weakness, intro_boss: boss }); }
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-5 text-center">
        <p className="text-2xl mb-2">🎬</p>
        <p className="text-xs text-neutral-500 uppercase tracking-widest mb-1">Character Intro</p>
        <p className="text-xl font-semibold mb-4">{character.name?.toUpperCase()} — Season 2026</p>
        <div className="text-sm text-neutral-300 space-y-2 text-left max-w-xs mx-auto">
          <p><span className="text-neutral-500">Главная способность:</span> {ability || "—"}</p>
          <p><span className="text-neutral-500">Слабость:</span> {weakness || "—"}</p>
          <p><span className="text-neutral-500">Финальный босс:</span> {boss || "—"}</p>
        </div>
      </div>
      {editable && (
        <div className="space-y-2">
          <input value={ability} onChange={(e) => setAbility(e.target.value)} placeholder="Главная способность" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" />
          <input value={weakness} onChange={(e) => setWeakness(e.target.value)} placeholder="Слабость" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" />
          <input value={boss} onChange={(e) => setBoss(e.target.value)} placeholder="Финальный босс" className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600" />
          <button onClick={save} className="w-full bg-neutral-800 hover:bg-neutral-700 rounded-lg py-2 text-sm">Сохранить</button>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "lore", label: "Лор", icon: "📖" },
  { key: "quotes", label: "Цитаты", icon: "💬" },
  { key: "gifts", label: "Подарки", icon: "🎁" },
  { key: "traits", label: "Статы", icon: "🎚️" },
  { key: "eggs", label: "Пасхалки", icon: "🧩" },
  { key: "intro", label: "Intro", icon: "🎬" },
];

function CharacterDetail({ characterId, session, onBack }) {
  const [character, setCharacter] = useState(null);
  const [tab, setTab] = useState("lore");
  const [loading, setLoading] = useState(true);
  const [showShare, setShowShare] = useState(false);

  const load = useCallback(async () => {
    const data = await db(`characters?id=eq.${characterId}`, { token: session.access_token });
    setCharacter(data?.[0] || null); setLoading(false);
  }, [characterId, session]);
  useEffect(() => { load(); }, [load]);

  async function updateCharacter(fields) {
    const [updated] = await db(`characters?id=eq.${characterId}`, { method: "PATCH", token: session.access_token, prefer: "return=representation", body: fields });
    setCharacter(updated);
  }
  async function togglePublic() { await updateCharacter({ is_public: !character.is_public }); }

  if (loading || !character) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Spinner className="text-2xl" /></div>;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      <div className="sticky top-0 bg-neutral-950/90 backdrop-blur border-b border-neutral-900 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={onBack} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200 text-sm">← Назад</button>
        <button onClick={() => setShowShare(true)} className="text-neutral-400 hover:text-neutral-200">🔗</button>
      </div>
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold shrink-0" style={{ background: `${(RARITY_COLORS[character.rarity] || RARITY_COLORS.Common)}22` }}>
            {character.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <input value={character.name} onChange={(e) => setCharacter({ ...character, name: e.target.value })} onBlur={(e) => updateCharacter({ name: e.target.value })} className="bg-transparent text-lg font-semibold outline-none w-full" />
            <input value={character.character_class || ""} onChange={(e) => setCharacter({ ...character, character_class: e.target.value })} onBlur={(e) => updateCharacter({ character_class: e.target.value })} placeholder="Класс персонажа" className="bg-transparent text-xs text-neutral-500 outline-none w-full" />
          </div>
          <RarityBadge rarity={character.rarity} />
        </div>
        <textarea value={character.arc || ""} onChange={(e) => setCharacter({ ...character, arc: e.target.value })} onBlur={(e) => updateCharacter({ arc: e.target.value })} placeholder='Арка: "Человек, который появился случайно"' rows={2} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-sm italic outline-none focus:border-neutral-600 resize-none mb-4" />
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0", tab === t.key ? "btn-accent font-medium" : "bg-neutral-900 text-neutral-400 border border-neutral-800")}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {tab === "lore" && <LoreTab characterId={character.id} token={session.access_token} editable={true} />}
        {tab === "quotes" && <QuotesTab characterId={character.id} token={session.access_token} editable={true} />}
        {tab === "gifts" && <GiftsTab characterId={character.id} token={session.access_token} editable={true} />}
        {tab === "traits" && <TraitsTab characterId={character.id} token={session.access_token} editable={true} />}
        {tab === "eggs" && <EggsTab characterId={character.id} token={session.access_token} editable={true} />}
        {tab === "intro" && <IntroTab character={character} editable={true} onSave={updateCharacter} />}
      </div>
      {showShare && <ShareModal character={character} onClose={() => setShowShare(false)} onTogglePublic={togglePublic} />}
    </div>
  );
}

function ShareModal({ character, onClose, onTogglePublic }) {
  const [copied, setCopied] = useState(false);
  function copyCode() {
    navigator.clipboard?.writeText(character.share_token).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  }
  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-sm p-5">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold flex items-center gap-2">🔗 Поделиться</h2>
          <button onClick={onClose}>✕</button>
        </div>
        <p className="text-sm text-neutral-400 mb-4">Включи публичный доступ, чтобы дать другу код. По коду он увидит эту карточку в режиме просмотра — без своего аккаунта.</p>
        <button onClick={onTogglePublic} className={cx("w-full rounded-lg py-2 text-sm font-medium mb-3", character.is_public ? "bg-neutral-800 text-neutral-200" : "btn-accent")}>
          {character.is_public ? "Публичный доступ включён — выключить" : "Включить публичный доступ"}
        </button>
        {character.is_public && (
          <div className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2 flex items-center justify-between">
            <span className="font-mono text-sm">{character.share_token}</span>
            <button onClick={copyCode} className="text-xs text-accent">{copied ? "Скопировано" : "Копировать"}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SharedSearchScreen({ onBack, onFound }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search() {
    if (!code.trim()) return;
    setLoading(true); setError("");
    try {
      const data = await db(`characters?share_token=eq.${code.trim()}&is_public=eq.true`, {});
      if (!data || data.length === 0) setError("Профиль не найден или недоступен.");
      else onFound(data[0].id);
    } catch (e) { setError("Ошибка поиска."); } finally { setLoading(false); }
  }
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <button onClick={onBack} className="flex items-center gap-1 text-neutral-400 mb-6 text-sm">← Назад</button>
        <h2 className="font-semibold mb-4">Посмотреть профиль по коду</h2>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Код профиля" className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-neutral-600 font-mono" onKeyDown={(e) => e.key === "Enter" && search()} />
          <button onClick={search} disabled={loading} className="btn-accent rounded-lg px-4 text-sm font-medium">{loading ? <Spinner /> : "Найти"}</button>
        </div>
        {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
      </div>
    </div>
  );
}

function SharedCharacterView({ characterId, onBack }) {
  const [character, setCharacter] = useState(null);
  const [tab, setTab] = useState("lore");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const data = await db(`characters?id=eq.${characterId}&is_public=eq.true`, {});
      setCharacter(data?.[0] || null); setLoading(false);
    })();
  }, [characterId]);
  if (loading) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Spinner className="text-2xl" /></div>;
  if (!character) return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-center gap-3">
      <p className="text-neutral-400 text-sm">Профиль не найден.</p>
      <button onClick={onBack} className="text-accent text-sm">Назад</button>
    </div>
  );
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      <div className="sticky top-0 bg-neutral-950/90 backdrop-blur border-b border-neutral-900 px-4 py-3 flex items-center justify-between z-10">
        <button onClick={onBack} className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200 text-sm">← Назад</button>
        <span className="text-xs text-neutral-500">👤 Режим просмотра</span>
      </div>
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-semibold shrink-0" style={{ background: `${(RARITY_COLORS[character.rarity] || RARITY_COLORS.Common)}22` }}>{character.name?.[0]?.toUpperCase()}</div>
          <div><p className="text-lg font-semibold">{character.name}</p><p className="text-xs text-neutral-500">{character.character_class}</p></div>
          <RarityBadge rarity={character.rarity} />
        </div>
        {character.arc && <p className="text-sm italic text-neutral-400 mb-4">"{character.arc}"</p>}
        <div className="flex gap-1 overflow-x-auto mb-4 pb-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className={cx("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap shrink-0", tab === t.key ? "btn-accent font-medium" : "bg-neutral-900 text-neutral-400 border border-neutral-800")}>{t.icon} {t.label}</button>
          ))}
        </div>
        {tab === "lore" && <LoreTab characterId={character.id} token={null} editable={false} />}
        {tab === "quotes" && <QuotesTab characterId={character.id} token={null} editable={false} />}
        {tab === "gifts" && <GiftsTab characterId={character.id} token={null} editable={false} />}
        {tab === "traits" && <TraitsTab characterId={character.id} token={null} editable={false} />}
        {tab === "eggs" && <EggsTab characterId={character.id} token={null} editable={false} />}
        {tab === "intro" && <IntroTab character={character} editable={false} onSave={() => {}} />}
      </div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState("dashboard");
  const [activeCharacterId, setActiveCharacterId] = useState(null);
  const [sharedCharacterId, setSharedCharacterId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.get("session");
        if (saved?.value) {
          const parsed = JSON.parse(saved.value);
          const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: parsed.refresh_token });
          setSession({ ...refreshed, username: parsed.username });
        }
      } catch (e) { /* stay logged out */ } finally { setBooting(false); }
    })();
  }, []);

  async function handleAuthed(data) {
    setSession(data);
    try { await storage.set("session", JSON.stringify({ refresh_token: data.refresh_token, username: data.username })); }
    catch (e) { console.error("Не удалось сохранить сессию", e); }
  }
  async function handleLogout() { setSession(null); setView("dashboard"); try { await storage.delete("session"); } catch (e) {} }

  if (booting) return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Spinner className="text-2xl" /></div>;

  if (view === "sharedSearch") return <SharedSearchScreen onBack={() => setView("dashboard")} onFound={(id) => { setSharedCharacterId(id); setView("sharedView"); }} />;
  if (view === "sharedView") return <SharedCharacterView characterId={sharedCharacterId} onBack={() => setView(session ? "dashboard" : "sharedSearch")} />;

  if (!session) {
    return (
      <div>
        <AuthScreen onAuthed={handleAuthed} />
        <div className="fixed bottom-4 inset-x-0 flex justify-center">
          <button onClick={() => setView("sharedSearch")} className="text-xs text-neutral-500 underline">У меня есть код профиля от друга</button>
        </div>
      </div>
    );
  }

  if (view === "detail" && activeCharacterId) return <CharacterDetail characterId={activeCharacterId} session={session} onBack={() => setView("dashboard")} />;

  return <Dashboard session={session} onOpenCharacter={(id) => { setActiveCharacterId(id); setView("detail"); }} onLogout={handleLogout} onOpenSharedSearch={() => setView("sharedSearch")} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
