/* What the desk spirit says. Pure data and selection: no DOM, no Three.js, no network.
   The room only ever calls `speech.say(context)`, so a model-backed provider can be
   dropped in later through `setProvider()` without touching the figure or the bubble.
   Any future provider must stay key-free in the browser; secrets never ship here. */

/**
 * @typedef {object} SpiritContext
 * @property {number} hour            Local hour, 0–23.
 * @property {boolean} night          Night lighting is on.
 * @property {string} view            Current camera preset id.
 * @property {number} pokeCount       Pokes so far in this visit, starting at 1.
 * @property {boolean} breeze         Window is open.
 * @property {string} printer         'idle' | 'printing' | 'paused' | 'done'
 * @property {boolean} iron           Soldering station is on.
 * @property {boolean} motor          Motor bench is running.
 * @property {boolean} arm            Robot arm is cycling.
 * @property {string} firmware        'idle' | 'flashing' | 'done'
 * @property {boolean} watering       Plant is being watered.
 * @property {number} soilMoisture    0–100.
 *
 * @typedef {object} SpiritReply
 * @property {string} text
 * @property {string} [mood]          'calm' | 'happy' | 'sleepy' | 'excited'
 * @property {string} [id]            Line group that produced the text.
 * @property {string} [source]        Provider name.
 *
 * @typedef {object} SpeechProvider
 * @property {string} [name]
 * @property {(context: SpiritContext) => Promise<string | SpiritReply>} say
 */

// Groups with a `when` guard only enter the pool while it holds. `priority` groups
// pre-empt everything else while they apply; `topical` groups (running devices) skip
// the short-term memory so the spirit keeps commenting on what is actually happening.
// `lines` are equivalent variants of the same thought.
export const spiritLines = [
    { id: 'first-meeting', priority: true, mood: 'happy', when: c => c.pokeCount === 1,
        lines: ['你好呀！我是住在桌上的小精灵。再戳戳我，我会说点别的。'] },
    { id: 'morning', weight: 2, when: c => !c.night && c.hour >= 5 && c.hour < 11,
        lines: ['早上好。阳光刚爬上桌子，先泡杯咖啡吧。', '新的一天，从一个小点子开始就好。'] },
    { id: 'noon', weight: 2, when: c => c.hour >= 11 && c.hour < 14,
        lines: ['中午啦，吃饭比修 bug 重要。', '歇一会儿，屏幕不会跑掉的。'] },
    { id: 'afternoon', weight: 2, when: c => c.hour >= 14 && c.hour < 18,
        lines: ['午后的光正好，适合做一点喜欢的事。', '下午容易困，我陪你晃一晃。'] },
    { id: 'evening', weight: 2, when: c => c.hour >= 18 && c.hour < 23,
        lines: ['傍晚了，把今天的进度存个档吧。', '窗外暗下来了，屋里的灯更暖了。'] },
    { id: 'late-night', weight: 3, mood: 'sleepy', when: c => c.hour >= 23 || c.hour < 5,
        lines: ['这么晚还醒着呀……记得早点休息。', '深夜的想法特别多，先写在本子上。'] },
    { id: 'night-lights', weight: 1.5, when: c => c.night,
        lines: ['架子下的灯亮着，我一点也不困。', '夜里的房间好安静，能听见风。'] },
    { id: 'curious',
        lines: ['保持好奇，慢慢创造。', '未完成的点子，也是好点子。', '今天想做点什么小东西？'] },
    { id: 'coffee',
        lines: ['杯子上写着 slow，慢一点也没关系。', '咖啡凉了记得续杯，灵感也是。'] },
    { id: 'notebook',
        lines: ['本子上的 little ideas，先动手哪一个？', '把想法写下来，它就不会飞走了。'] },
    { id: 'window-open', when: c => c.breeze,
        lines: ['窗开着，风把田野的味道带进来了。', '云在慢慢走，鸟也在。'] },
    { id: 'window-closed', when: c => c.breeze === false,
        lines: ['窗关上了，不过外面的云还在走。', '想听风的话，把窗打开就好。'] },
    { id: 'printing', topical: true, weight: 4, mood: 'excited', when: c => c.printer === 'printing',
        lines: ['打印机在一层一层长出零件，好神奇。', '听，喷头在轻轻唱歌。'] },
    { id: 'printed', topical: true, weight: 3, mood: 'happy', when: c => c.printer === 'done',
        lines: ['零件打印好了！去看看它长什么样。'] },
    { id: 'soldering', topical: true, weight: 4, when: c => c.iron,
        lines: ['烙铁热了，小心手指哦。', '焊锡的味道……好在风扇开着。'] },
    { id: 'motor', topical: true, weight: 4, mood: 'excited', when: c => c.motor,
        lines: ['电机转得好快，我看得有点晕。', '嗡嗡嗡——是代码在转圈。'] },
    { id: 'arm', topical: true, weight: 4, when: c => c.arm,
        lines: ['机械臂在认真搬东西，我在认真看。', '取、放、取、放，它一点都不累。'] },
    { id: 'flashing', topical: true, weight: 4, when: c => c.firmware === 'flashing',
        lines: ['固件正在写进去……千万别断电。'] },
    { id: 'flashed', weight: 2, mood: 'happy', when: c => c.firmware === 'done',
        lines: ['Hello, world！板子醒过来了。'] },
    { id: 'plant-thirsty', weight: 1.5, when: c => !c.watering && c.soilMoisture < 50,
        lines: ['旁边的小植物有点渴了。'] },
    { id: 'plant-drinking', topical: true, weight: 4, mood: 'happy', when: c => c.watering,
        lines: ['谢谢你给它浇水，它在慢慢喝。'] },
    { id: 'plant-happy', weight: 1.5, mood: 'happy', when: c => !c.watering && c.soilMoisture >= 70,
        lines: ['小植物喝饱了，叶子都精神了。'] },
    { id: 'shelf-figures',
        lines: ['架子上的三位，晚上会不会偷偷聊天呢？'] },
    { id: 'about-me',
        lines: ['我现在只会说这些话，以后也许能真的聊天。', '我是程序算出来的，一个模型文件都没用。'] },
    { id: 'encourage',
        lines: ['做不出来也没关系，休息一下再回来。', '每个小 bug，都是一个小谜题。'] },
    { id: 'panorama', weight: 3, when: c => c.view === 'panorama',
        lines: ['从这里看，整间房子都装进纸里了。'] },
    { id: 'poked-a-lot', weight: 2, mood: 'happy', when: c => c.pokeCount >= 6,
        lines: ['再戳我，我就要变成开发板了。', '好啦好啦，我在呢。', '你是在测试我的耐心吗？（我没有）'] }
];

function applies(group, context) {
    if (!group.when) return true;
    try { return !!group.when(context); } catch { return false; }
}

/**
 * Offline provider: weighted pick among the groups whose guard holds, avoiding the
 * last few groups and never repeating the previous sentence back to back.
 * @returns {SpeechProvider}
 */
export function createBuiltinSpeech({ lines = spiritLines, random = Math.random, memory = 4 } = {}) {
    const recent = [];
    let lastText = '';
    return {
        name: 'builtin',
        async say(context = {}) {
            let pool = lines.filter(group => group.lines?.length && applies(group, context));
            if (!pool.length) return { text: '……', mood: 'calm', id: 'silence', source: 'builtin' };
            const urgent = pool.filter(group => group.priority);
            if (urgent.length) pool = urgent;
            const fresh = pool.filter(group => group.topical || !recent.includes(group.id));
            const choices = fresh.length ? fresh : pool;
            const total = choices.reduce((sum, group) => sum + (group.weight || 1), 0);
            let roll = random() * total, group = choices[choices.length - 1];
            for (const candidate of choices) {
                roll -= candidate.weight || 1;
                if (roll < 0) { group = candidate; break; }
            }
            const variants = group.lines.length > 1 ? group.lines.filter(text => text !== lastText) : group.lines;
            const text = variants[Math.min(variants.length - 1, Math.floor(random() * variants.length))];
            recent.push(group.id);
            if (recent.length > memory) recent.shift();
            lastText = text;
            return { text, mood: group.mood || 'calm', id: group.id, source: 'builtin' };
        }
    };
}

function withTimeout(promise, ms) {
    if (!(ms > 0)) return promise;
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`spirit provider timed out after ${ms}ms`)), ms); })
    ]).finally(() => clearTimeout(timer));
}

/**
 * The seam the room talks to. Today it forwards to the built-in lines; later,
 * `setProvider({ name, say })` can route the same context to a model, while the
 * built-in lines keep answering on timeout, error or empty replies.
 */
export function createSpiritSpeech({ provider = null, fallback = createBuiltinSpeech(), timeout = 6000, onError = error => console.warn('Spirit provider fell back to built-in lines:', error) } = {}) {
    let current = provider || fallback;
    async function say(context) {
        if (current === fallback) return fallback.say(context);
        try {
            const reply = await withTimeout(Promise.resolve(current.say(context)), timeout);
            const text = (typeof reply === 'string' ? reply : reply?.text)?.trim();
            if (text) return { mood: 'calm', ...(typeof reply === 'object' && reply ? reply : {}), text, source: current.name || 'provider' };
        } catch (error) {
            onError(error);
        }
        return fallback.say(context);
    }
    return {
        say,
        setProvider(next) { current = next && typeof next.say === 'function' ? next : fallback; },
        getProvider: () => current
    };
}
