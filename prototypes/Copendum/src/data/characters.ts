import type { CharacterData } from "../engine/Character";

// Eight demo characters — fantasy RPG archetypes.
// Each has JSON metadata and an HTML biography with embedded media.

export const charactersData: CharacterData[] = [
  {
    id: "elara-moonwhisper",
    metadata: {
      firstName: "Elara",
      surname: "Moonwhisper",
      nationality: "Sylvani Elf",
      gender: "Female",
      age: 247,
    },
    class: "Ranger",
    level: 14,
    alignment: "Neutral Good",
    portrait: "/portraits/elara.jpg",
    accent: "#4a9d5f",
    stats: {
      strength: 12,
      dexterity: 19,
      constitution: 14,
      intelligence: 16,
      wisdom: 18,
      charisma: 13,
    },
    skills: [
      { name: "Longbow Mastery", rank: 5 },
      { name: "Shadow Strike", rank: 4 },
      { name: "Beast Bond", rank: 3 },
      { name: "Evasion", rank: 5 },
    ],
    equipment: ["Moonwood Longbow", "Elven Cloak of Shadows", "Emerald Amulet"],
    quote: "The forest does not forget. Neither do I.",
    biography: `
      <h3>The Warden of Verdant Whispers</h3>
      <p>Born beneath the silver boughs of the Elderwood, Elara Moonwhisper learned the language of wind and leaf before she could speak her own tongue. Her mother, a revered ranger-warden, taught her to track a deer across moonlit snow; her father, an astronomer of the elven court, taught her to read the stars as one reads a letter from a distant friend.</p>
      <p>For two centuries Elara walked the borders between the mortal realms and the Feywild, serving as warden of the Verdant Marches. When the Blight came — a creeping rot that turned ancient trees to ash — she stood alone against a tide of shadow, her arrows singing hymns of iron and starlight.</p>
      <blockquote>"I have lost three brothers to the Blight. I will not lose the forest too."</blockquote>
      <p>She is rarely seen without her faithful wolf companion, Fenris, a beast of silver fur and amber eyes. Together, they wander the broken edges of the world, mending what men have torn and remembering what the young have forgotten.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1448375240586-882707db888b?w=400" alt="Forest" />
        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400" alt="Moonlit trees" />
        <img src="https://images.unsplash.com/photo-1507041957456-9c39d97a44ff?w=400" alt="Bow" />
      </div>
      <p><a href="#">See the Ballad of the Verdant Marches</a></p>
    `,
  },
  {
    id: "kaelen-ironforge",
    metadata: {
      firstName: "Kaelen",
      surname: "Ironforge",
      nationality: "Khaz-Gal Dwarven",
      gender: "Male",
      age: 182,
    },
    class: "Warrior / Smith",
    level: 16,
    alignment: "Lawful Good",
    portrait: "/portraits/kaelen.jpg",
    accent: "#c26a1f",
    stats: {
      strength: 20,
      dexterity: 12,
      constitution: 19,
      intelligence: 14,
      wisdom: 15,
      charisma: 10,
    },
    skills: [
      { name: "Mountain's Endurance", rank: 5 },
      { name: "Runeforging", rank: 5 },
      { name: "Hammer of the Forge", rank: 4 },
      { name: "Stoneblood", rank: 3 },
    ],
    equipment: ["Ironforge Warhammer", "Anvilheart Plate", "Rune of Embers"],
    quote: "Iron does not lie. Fire does not flatter.",
    biography: `
      <h3>Lord of the Burning Anvil</h3>
      <p>Seventh son of the High Smith of Khaz-Gal, Kaelen Ironforge was swung from a cradle of iron and sung to by the ringing of hammers. He could shape steel before he could shave his beard — and by the time his beard grew long and red as forge-flame, he had crafted blades that sang in the dark.</p>
      <p>His masterwork, the axe <em>Cinder-Queen</em>, is said to burn with the memory of a dragon he slew in the deep places of the world. He does not speak of that day. He speaks only of steel, and stone, and the slow, patient honesty of fire.</p>
      <blockquote>"A blade is a promise. Break it, and you break yourself."</blockquote>
      <p>Now in his twilight, Kaelen takes only one apprentice at a time. He is gruff, exacting, and unbearably fond of honey-mead. Travelers who come to his forge with honest work in their eyes may find a weapon that outlives empires. Those who come with greed find only cold iron and a closed door.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1504198266287-1659872e6590?w=400" alt="Forge fire" />
        <img src="https://images.unsplash.com/photo-1519762957079-253f2a9500d4?w=400" alt="Anvil" />
        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400" alt="Metalwork" />
      </div>
    `,
  },
  {
    id: "seraphina-duskmere",
    metadata: {
      firstName: "Seraphina",
      surname: "Duskmere",
      nationality: "Valorian Human",
      gender: "Female",
      age: 34,
    },
    class: "Sorceress",
    level: 17,
    alignment: "Chaotic Neutral",
    portrait: "/portraits/seraphina.jpg",
    accent: "#8a4ad4",
    stats: {
      strength: 8,
      dexterity: 14,
      constitution: 12,
      intelligence: 20,
      wisdom: 16,
      charisma: 18,
    },
    skills: [
      { name: "Arcane Tempest", rank: 5 },
      { name: "Shadow Weave", rank: 4 },
      { name: "Mind Rend", rank: 4 },
      { name: "Astral Walk", rank: 3 },
    ],
    equipment: ["Orb of the Dusk", "Tome of Unravelled Names", "Ring of Voids"],
    quote: "The stars are not gods. They are doors. I have walked through them.",
    biography: `
      <h3>The Witch of Violet Silence</h3>
      <p>Seraphina Duskmere was born during an eclipse in the coastal city of Valoria, and the midwives whispered that the moon had blinked at her. At thirteen she accidentally turned her tutor into a song. At seventeen she burned the library of her own academy to learn what the books had tried to hide.</p>
      <p>She wears grief like perfume — faint, expensive, and impossible to ignore. She has outlived two husbands, three lovers, and every friend she made before her twentieth year. She has made peace with this. She has not made peace with the gods who arranged it.</p>
      <blockquote>"Magic is not a gift. It is a debt. And the interest is always worse than you expect."</blockquote>
      <p>She currently resides in a crooked tower above the Duskmere estuary, where she studies the architecture of dreams. She takes apprentices only if they can make her laugh. None have, so far.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400" alt="Magic" />
        <img src="https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400" alt="Stars" />
        <img src="https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400" alt="Mystical" />
      </div>
    `,
  },
  {
    id: "thorne-blackthorn",
    metadata: {
      firstName: "Thorne",
      surname: "Blackthorn",
      nationality: "Half-Orc of Vorn",
      gender: "Male",
      age: 41,
    },
    class: "Paladin",
    level: 15,
    alignment: "Lawful Neutral",
    portrait: "/portraits/thorne.jpg",
    accent: "#b4b4b4",
    stats: {
      strength: 19,
      dexterity: 11,
      constitution: 18,
      intelligence: 13,
      wisdom: 17,
      charisma: 14,
    },
    skills: [
      { name: "Oath of Iron", rank: 5 },
      { name: "Shield of the Martyr", rank: 4 },
      { name: "Smite of Dawn", rank: 4 },
      { name: "Unbreaking", rank: 3 },
    ],
    equipment: ["Hammer of the First Oath", "Plate of the Grey Pilgrim", "Sigil of Mercy"],
    quote: "Mercy is not weakness. It is the heaviest thing a strong man carries.",
    biography: `
      <h3>The Grey Pilgrim</h3>
      <p>Thorne Blackthorn was born to a human mother and an orcish father who met on a battlefield and parted on the same one. He was raised in the monastery of Saint Yvaine, where the brothers taught him that strength without mercy is a wound without a bandage.</p>
      <p>He carries a war hammer blessed by seven different faiths, none of which entirely agree. He does not mind. He has knelt at every altar and found something worth protecting in each.</p>
      <blockquote>"I have broken more skulls than I can count. I have buried more friends than I can name. But I have never — not once — broken an oath."</blockquote>
      <p>He walks the old roads alone now, a pilgrim with no shrine, guarding travelers who cannot guard themselves. When asked why he does not rest, he answers only: "Because the road does not."</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400" alt="Cathedral" />
        <img src="https://images.unsplash.com/photo-1519892300165-cb558214778d?w=400" alt="Road" />
        <img src="https://images.unsplash.com/photo-1518709594023-6eab9bab7b23?w=400" alt="Old stones" />
      </div>
    `,
  },
  {
    id: "lyra-silverveil",
    metadata: {
      firstName: "Lyra",
      surname: "Silverveil",
      nationality: "Halfling of Brackenmere",
      gender: "Female",
      age: 29,
    },
    class: "Bard",
    level: 12,
    alignment: "Chaotic Good",
    portrait: "/portraits/lyra.jpg",
    accent: "#e0a03a",
    stats: {
      strength: 8,
      dexterity: 16,
      constitution: 13,
      intelligence: 14,
      wisdom: 13,
      charisma: 20,
    },
    skills: [
      { name: "Silver-Tongued Verse", rank: 5 },
      { name: "Lute of the Wandering Wind", rank: 5 },
      { name: "Lucky Foot", rank: 4 },
      { name: "Tavern Tale", rank: 3 },
    ],
    equipment: ["Lute of Silverveil", "Traveler's Cloak", "Lucky Copper"],
    quote: "Every story is true somewhere. And every somewhere needs a better story.",
    biography: `
      <h3>The Song That Walks</h3>
      <p>Lyra Silverveil was the ninth child of a turnip farmer in Brackenmere, and she left home at sixteen with nothing but a lute, a mule named Gerald, and a pocketful of lies. She has since collected approximately four hundred more lies, most of which she now calls "songs."</p>
      <p>Her music has calmed rioting mobs, charmed dragons into giving up their hoards (temporarily), and once, memorably, convinced a duke that he was actually a teapot. (The duke was not a teapot. The story improves with each retelling.)</p>
      <blockquote>"A hero is just a liar whose story caught fire."</blockquote>
      <p>She travels the realm collecting tales, coin, and the occasional stray dog. She is currently writing a ballad about a king who fell in love with a goose. It is, she insists, based on a true story. She will not elaborate.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=400" alt="Music" />
        <img src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400" alt="Lute" />
        <img src="https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=400" alt="Tavern" />
      </div>
    `,
  },
  {
    id: "darius-stormwind",
    metadata: {
      firstName: "Darius",
      surname: "Stormwind",
      nationality: "Imperial Human",
      gender: "Male",
      age: 52,
    },
    class: "Knight Commander",
    level: 18,
    alignment: "Lawful Good",
    portrait: "/portraits/darius.jpg",
    accent: "#4a6fd4",
    stats: {
      strength: 18,
      dexterity: 14,
      constitution: 17,
      intelligence: 16,
      wisdom: 16,
      charisma: 17,
    },
    skills: [
      { name: "Banner of the Storm", rank: 5 },
      { name: "Shield Wall", rank: 5 },
      { name: "Commander's Voice", rank: 4 },
      { name: "Last Stand", rank: 3 },
    ],
    equipment: ["Blade of the Storm King", "Plate of the Blue Vanguard", "Cloak of Sovereign Blue"],
    quote: "A commander who will not bleed with his soldiers deserves no soldiers at all.",
    biography: `
      <h3>The Storm Who Wore a Crown of Scars</h3>
      <p>Darius Stormwind was a common soldier at sixteen, a captain at twenty-four, and a commander at thirty. He earned each rank not through lineage or favor but by being the last man standing on every field where lesser men had fallen.</p>
      <p>He has lost an eye to a Sarni arrow, a brother to the Red Plague, and his youth to the Long War of the Nine Kings. He has not lost his voice, which remains the most terrible weapon in the Imperial arsenal. When Darius speaks, armies march. When Darius whispers, empires reconsider.</p>
      <blockquote>"I do not ask my soldiers to die for me. I ask them to live — and I will die to make it so."</blockquote>
      <p>He keeps a small journal in which he writes the name of every soldier lost under his command. The book is nearly full. He begins a new one each spring, and each spring prays he will not have to fill it.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400" alt="Castle" />
        <img src="https://images.unsplash.com/photo-1519892300165-cb558214778d?w=400" alt="Banners" />
        <img src="https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=400" alt="Sunset" />
      </div>
    `,
  },
  {
    id: "nyx-shadowmere",
    metadata: {
      firstName: "Nyx",
      surname: "Shadowmere",
      nationality: "Tiefling of the Red Quarter",
      gender: "Female",
      age: 28,
    },
    class: "Rogue",
    level: 16,
    alignment: "Neutral Evil",
    portrait: "/portraits/nyx.jpg",
    accent: "#b4253a",
    stats: {
      strength: 11,
      dexterity: 20,
      constitution: 13,
      intelligence: 16,
      wisdom: 12,
      charisma: 17,
    },
    skills: [
      { name: "Crimson Dance", rank: 5 },
      { name: "Whisper Step", rank: 5 },
      { name: "Poison Kiss", rank: 4 },
      { name: "Shadow Ledger", rank: 3 },
    ],
    equipment: ["Twin Daggers of the Red Hand", "Silk of the Ninth Night", "Coin of the Unmarked Grave"],
    quote: "Every secret has a price. I simply know what yours is.",
    biography: `
      <h3>The Red Hand of the Quarter</h3>
      <p>Nyx Shadowmere was born in a gutter behind a brothel in the Red Quarter of Vael and learned to pick a purse before she learned to read. By twenty she ran the Thieves' Guild. By twenty-five she ran the city — though no one in the city would admit it, least of all her.</p>
      <p>She has horns, fangs, a laugh like a coin dropped on marble, and a reputation that is ninety percent rumor. The ten percent that is true would ruin several dukes, three cardinals, and one extremely embarrassed dragon.</p>
      <blockquote>"Honesty is a luxury for people who don't have debts."</blockquote>
      <p>She keeps a ledger of every favor owed to her, written in a cipher only she and her dead sister can read. The ledger is longer than most holy books, and far better indexed.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1519608487953-e999c86e7455?w=400" alt="Night city" />
        <img src="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400" alt="Alley" />
        <img src="https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400" alt="Candles" />
      </div>
    `,
  },
  {
    id: "orion-ashfall",
    metadata: {
      firstName: "Orion",
      surname: "Ashfall",
      nationality: "Copper Dragonborn of Pyrrhia",
      gender: "Male",
      age: 78,
    },
    class: "Mage",
    level: 19,
    alignment: "True Neutral",
    portrait: "/portraits/orion.jpg",
    accent: "#c46a2a",
    stats: {
      strength: 14,
      dexterity: 11,
      constitution: 15,
      intelligence: 20,
      wisdom: 18,
      charisma: 13,
    },
    skills: [
      { name: "Breath of Ash", rank: 5 },
      { name: "Codex of Ember", rank: 5 },
      { name: "Runic Seal", rank: 4 },
      { name: "Time-Light", rank: 3 },
    ],
    equipment: ["Staff of the First Flame", "Ashen Robes", "Tome of Unwritten Tomorrows"],
    quote: "A scholar who fears the future is no scholar at all. He is merely a historian with bad timing.",
    biography: `
      <h3>The Last Librarian of Pyrrhia</h3>
      <p>Orion Ashfall remembers when the great libraries of Pyrrhia numbered forty-three. Now he remembers when they numbered three. He remembers the rest because he wrote it down, and he writes it down because he remembers it. It is a circle, and he is its patient center.</p>
      <p>He is one of the last dragonborn of the Copper Flight, which once served as the scribes and scholars of the great wyrms. Now he serves only the books — and the occasional apprentice who can resist the temptation to steal pages for profit.</p>
      <blockquote>"Empires fall. Dragons die. But a well-footnoted argument? That is forever."</blockquote>
      <p>He is writing, at present, a history of the world. He is on volume thirty-seven and suspects he will need at least forty more. He is not in any hurry. He has seen empires. He has seen dragons. He has seen that patience is its own form of magic.</p>
      <div class="media-gallery">
        <img src="https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400" alt="Library" />
        <img src="https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=400" alt="Books" />
        <img src="https://images.unsplash.com/photo-1532012197267-da84d127e765?w=400" alt="Scrolls" />
      </div>
    `,
  },
];
