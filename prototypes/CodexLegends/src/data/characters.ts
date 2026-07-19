// ============================================================
//  The Codex — curated character documents.
//  Each card = metadata (JSON) + Markdown biography + mixed media.
// ============================================================

import type { Character } from "@/types/character";

import elaraPortrait from "@/assets/portraits/elara.jpg";
import theronPortrait from "@/assets/portraits/theron.jpg";
import miraPortrait from "@/assets/portraits/mira.jpg";
import kaelPortrait from "@/assets/portraits/kael.jpg";
import seraphinaPortrait from "@/assets/portraits/seraphina.jpg";
import garrickPortrait from "@/assets/portraits/garrick.jpg";
import lyraPortrait from "@/assets/portraits/lyra.jpg";
import orinPortrait from "@/assets/portraits/orin.jpg";

/** Atmospheric stock scenery used in the media galleries. */
export const SCENES = [
  { src: "https://images.pexels.com/photos/14590273/pexels-photo-14590273.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "Storm breaking over the Grey Marches" },
  { src: "https://images.pexels.com/photos/29546721/pexels-photo-29546721.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "The silent pines of the Sylvan Reach" },
  { src: "https://images.pexels.com/photos/3208884/pexels-photo-3208884.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "Mist upon the hills of Vaelmark" },
  { src: "https://images.pexels.com/photos/34392630/pexels-photo-34392630.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "Cloud over the Celestine Isles" },
  { src: "https://images.pexels.com/photos/13124405/pexels-photo-13124405.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "A lone peak above the Grit Wastes" },
  { src: "https://images.pexels.com/photos/13007779/pexels-photo-13007779.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "The shrouded marches at dawn" },
  { src: "https://images.pexels.com/photos/29546725/pexels-photo-29546725.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "A path into the Undercity wood" },
  { src: "https://images.pexels.com/photos/29546714/pexels-photo-29546714.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200", caption: "Black Forest, where the exiled walk" },
];

export const PORTRAIT_POOL = [
  elaraPortrait,
  theronPortrait,
  miraPortrait,
  kaelPortrait,
  seraphinaPortrait,
  garrickPortrait,
  lyraPortrait,
  orinPortrait,
];

export const CHARACTERS: Character[] = [
  {
    meta: {
      id: "elara-moonwhisper",
      firstName: "Elara",
      surname: "Moonwhisper",
      nationality: "Sylvan Reach",
      gender: "Female",
      age: 142,
      species: "High Elf",
      archetype: "Ranger",
      element: "Nature",
      rarity: "Legendary",
      title: "Warden of the Whisperwood",
      born: "Year 412 of the Verdant Reckoning",
      accent: "#34d3b8",
    },
    portrait: elaraPortrait,
    stats: [
      { key: "might", label: "Might", value: 58 },
      { key: "agility", label: "Agility", value: 96 },
      { key: "intellect", label: "Intellect", value: 82 },
      { key: "resolve", label: "Resolve", value: 78 },
      { key: "arcana", label: "Arcana", value: 71 },
      { key: "charisma", label: "Charisma", value: 74 },
    ],
    quote: "The forest does not raise its voice. It does not need to.",
    aliases: ["The Silver Arrow", "Whisperwood's Shadow"],
    gallery: [SCENES[1], SCENES[6], SCENES[2]],
    relations: [
      { targetId: "theron-ashbane", label: "Reluctant ally" },
      { targetId: "lyra-nightshade", label: "Old debt" },
    ],
    theme: { root: 110, scale: [0, 3, 5, 7, 10], tempo: 76, wave: "triangle", bass: "sine" },
    biography: `## Warden of the Whisperwood

Born beneath an aurora that the elders swore had not been seen for three centuries, **Elara Moonwhisper** has guarded the Sylvan Reach longer than most bloodlines have existed. She remembers the forest before the roads, and she intends to outlive the roads as well.

### The Long Hunt
For eleven winters she tracked the hart-god of the eastern ridges — not to slay it, but to return a single antler it had shed in her mother's cradle. She speaks to ravens, reads weather in the bark of oaks, and has never once been heard approaching.

> *"You measure distance in leagues. I measure it in breaths left to warn me."*

- **Signature:** yew longbow *Silvervein*, strung with starlight
- **Known weakness:** will not raise a hand against a child of any species
- **Wanted by:** the Timber Lords of Harrowgate

She and [Theron Ashbane](#theron-ashbane) once stood back-to-back against the Hollow Court — an alliance neither has spoken of since, and neither has forgotten.`,
  },
  {
    meta: {
      id: "theron-ashbane",
      firstName: "Theron",
      surname: "Ashbane",
      nationality: "Vaelmark",
      gender: "Male",
      age: 34,
      species: "Human",
      archetype: "Knight",
      element: "Light",
      rarity: "Epic",
      title: "The Oath Unbroken",
      born: "Year 680 of the Ashen Era",
      accent: "#60a5fa",
    },
    portrait: theronPortrait,
    stats: [
      { key: "might", label: "Might", value: 88 },
      { key: "agility", label: "Agility", value: 64 },
      { key: "intellect", label: "Intellect", value: 70 },
      { key: "resolve", label: "Resolve", value: 95 },
      { key: "arcana", label: "Arcana", value: 55 },
      { key: "charisma", label: "Charisma", value: 80 },
    ],
    quote: "An oath is a bridge. Burn it, and you maroon yourself.",
    aliases: ["The Unbroken", "Knight of the Last Gate"],
    gallery: [SCENES[2], SCENES[0], SCENES[5]],
    relations: [
      { targetId: "seraphina-dawn", label: "Sworn to the same Light" },
      { targetId: "garrick-sundering", label: "Brother-in-arms" },
    ],
    theme: { root: 196, scale: [0, 2, 4, 7, 9], tempo: 88, wave: "square", bass: "triangle" },
    biography: `## The Oath Unbroken

**Theron Ashbane** is the last knight of the Order of the Last Gate — an order he himself closed, sealing its vault with his own bloodied gauntlet. He carries the gate's key still, though he has forgotten what it opens.

### The Siege of Palemoor
When the city burned, every lord fled. Theron walked *into* the fire and walked out the other side with thirty-seven orphans. The scar across his cheek is not from a blade. It is from a beam he held aloft until they were all through.

> *"Honour is not what you are remembered for. It is what you do when no one is left to remember."*

- **Arms:** greatsword *Dawnsplitter*, forged from a fallen star
- **Vow:** to never sheathe his sword while an innocent is in danger
- **Buried secret:** he knows the true name of [Orin Voidcaller](#orin-voidcaller)

He fights beside [Garrick the Sundering](#garrick-sundering) whenever coin and conscience align — which is rarely the same week.`,
  },
  {
    meta: {
      id: "mira-corvin",
      firstName: "Mira",
      surname: "Corvin",
      nationality: "The Pale Coast",
      gender: "Female",
      age: 28,
      species: "Human",
      archetype: "Sorcerer",
      element: "Storm",
      rarity: "Mythic",
      title: "The Tempest's Daughter",
      born: "Year 704 of the Ashen Era",
      accent: "#38bdf8",
    },
    portrait: miraPortrait,
    stats: [
      { key: "might", label: "Might", value: 46 },
      { key: "agility", label: "Agility", value: 72 },
      { key: "intellect", label: "Intellect", value: 90 },
      { key: "resolve", label: "Resolve", value: 76 },
      { key: "arcana", label: "Arcana", value: 98 },
      { key: "charisma", label: "Charisma", value: 68 },
    ],
    quote: "I do not command the storm. I simply refuse to apologise for it.",
    aliases: ["Vesper", "The Living Gale"],
    gallery: [SCENES[0], SCENES[3], SCENES[5]],
    relations: [
      { targetId: "orin-voidcaller", label: "Forbidden mentor" },
      { targetId: "lyra-nightshade", label: "Mutual blackmail" },
    ],
    theme: { root: 220, scale: [0, 2, 4, 6, 8, 10], tempo: 96, wave: "sawtooth", bass: "sine" },
    biography: `## The Tempest's Daughter

Lightning does not strike the same place twice — unless that place is **Mira Corvin**, who was born during a storm that killed nine ships and has been followed by thunder ever since.

### A Gift That Bites Back
Her power is vast and *hungry*. Every spell she casts shortens something: her memory, her years, or her shadow. She keeps a tally in a journal she no longer remembers starting.

> *"They call it a gift. A gift has a giver. This one has teeth."*

- **School:** storm-calling, raw and untrained by any academy
- **Cost:** each major working erases one of her childhood memories
- **Alliance of convenience:** [Lyra Nightshade](#lyra-nightshade) holds a page of her journal

She apprenticed, briefly and disastrously, under [Orin Voidcaller](#orin-voidcaller). She left with his left hand. He does not speak of her.`,
  },
  {
    meta: {
      id: "kael-ironfist",
      firstName: "Kael",
      surname: "Ironfist",
      nationality: "Khaldur",
      gender: "Male",
      age: 76,
      species: "Dwarf",
      archetype: "Artificer",
      element: "Iron",
      rarity: "Rare",
      title: "Runesmith of Khaldur",
      born: "Year 528 of the Ashen Era",
      accent: "#fb923c",
    },
    portrait: kaelPortrait,
    stats: [
      { key: "might", label: "Might", value: 84 },
      { key: "agility", label: "Agility", value: 50 },
      { key: "intellect", label: "Intellect", value: 88 },
      { key: "resolve", label: "Resolve", value: 90 },
      { key: "arcana", label: "Arcana", value: 79 },
      { key: "charisma", label: "Charisma", value: 58 },
    ],
    quote: "Steel forgets nothing. It is the smith who must remember what to teach it.",
    aliases: ["The Emberhand", "Forgefather"],
    gallery: [SCENES[4], SCENES[5], SCENES[2]],
    relations: [
      { targetId: "garrick-sundering", label: "Arms supplier" },
      { targetId: "theron-ashbane", label: "Forged his blade" },
    ],
    theme: { root: 146.83, scale: [0, 3, 5, 7, 10], tempo: 104, wave: "sawtooth", bass: "square" },
    biography: `## Runesmith of Khaldur

**Kael Ironfist** has hammered metal for so long that the runes have hammered him back. The glowing sigils crawling up his forearms are not tattoos — they are the marks of a craft that has begun to think for itself.

### The Ember Forge
Deep beneath Khaldur, his forge never cools. He has made blades that choose their bearers, locks that answer to riddles, and — once, against his better judgement — a heart for something that should not have lived.

> *"You want a weapon? Bring me ore and patience. You want a legend? Bring me both, and wait a decade."*

- **Masterwork:** *Dawnsplitter*, the star-iron sword of [Theron Ashbane](#theron-ashbane)
- **Quirk:** speaks to his hammer by name (Bitter)
- **Regret:** the living heart still beats, somewhere

He arms [Garrick the Sundering](#garrick-sundering) when the cause is right and the gold is honest — two conditions Garrick tests constantly.`,
  },
  {
    meta: {
      id: "seraphina-dawn",
      firstName: "Seraphina",
      surname: "Dawn",
      nationality: "Celestine Isles",
      gender: "Female",
      age: 26,
      species: "Aasimar",
      archetype: "Cleric",
      element: "Light",
      rarity: "Epic",
      title: "Vessel of the Morning",
      born: "Year 712 of the Ashen Era",
      accent: "#fbbf24",
    },
    portrait: seraphinaPortrait,
    stats: [
      { key: "might", label: "Might", value: 60 },
      { key: "agility", label: "Agility", value: 66 },
      { key: "intellect", label: "Intellect", value: 84 },
      { key: "resolve", label: "Resolve", value: 92 },
      { key: "arcana", label: "Arcana", value: 90 },
      { key: "charisma", label: "Charisma", value: 94 },
    ],
    quote: "The dawn does not negotiate with the dark. It simply arrives.",
    aliases: ["The Morning Vessel", "Sun-touched"],
    gallery: [SCENES[3], SCENES[4], SCENES[6]],
    relations: [
      { targetId: "theron-ashbane", label: "Bound by the Light" },
      { targetId: "orin-voidcaller", label: "Opposite number" },
    ],
    theme: { root: 261.63, scale: [0, 2, 4, 7, 9], tempo: 70, wave: "sine", bass: "sine" },
    biography: `## Vessel of the Morning

When **Seraphina Dawn** prays, the light answers — not always in words, and not always kindly. She is the Celestine Isles' youngest High Cleric in four hundred years, and she did not ask for the title.

### The Weight of Radiance
To heal is to take the wound into yourself. Seraphina's body is a ledger of every life she has mended. She limps only when it rains, and it always rains somewhere.

> *"Mercy is not soft. Mercy is the hardest thing the light will ever ask of you."*

- **Domain:** healing, warding, and the binding of broken oaths
- **Cost:** she carries the scars of those she saves
- **Burdens:** she can feel [Orin Voidcaller](#orin-voidcaller) whenever he speaks a soul's name

She shares a sacred oath with [Theron Ashbane](#theron-ashbane); together they are the last wardens of a faith the world is forgetting.`,
  },
  {
    meta: {
      id: "garrick-sundering",
      firstName: "Garrick",
      surname: "the Sundering",
      nationality: "The Grit Wastes",
      gender: "Male",
      age: 41,
      species: "Half-Orc",
      archetype: "Barbarian",
      element: "Iron",
      rarity: "Rare",
      title: "Breaker of Walls",
      born: "Year 697 of the Ashen Era",
      accent: "#f87171",
    },
    portrait: garrickPortrait,
    stats: [
      { key: "might", label: "Might", value: 98 },
      { key: "agility", label: "Agility", value: 70 },
      { key: "intellect", label: "Intellect", value: 52 },
      { key: "resolve", label: "Resolve", value: 86 },
      { key: "arcana", label: "Arcana", value: 30 },
      { key: "charisma", label: "Charisma", value: 64 },
    ],
    quote: "Think quietly. Then hit it until the thinking stops mattering.",
    aliases: ["Wallcracker", "The Quiet Storm"],
    gallery: [SCENES[4], SCENES[0], SCENES[5]],
    relations: [
      { targetId: "theron-ashbane", label: "Blood brother" },
      { targetId: "kael-ironfist", label: "Trusted smith" },
    ],
    theme: { root: 110, scale: [0, 1, 3, 5, 7, 8, 10], tempo: 112, wave: "sawtooth", bass: "square" },
    biography: `## Breaker of Walls

They call him **the Sundering** because nothing he has set his shoulder to has remained standing. Garrick speaks little, eats enormously, and has never lost a thing he decided to keep.

### The Wall at Greymere
When an entire mercenary company fled the siege of Greymere, Garrick walked up to the gate alone, rested his palm on it, and *asked* it to move. The wall, by every account, apologised.

> *"Big walls, small walls — they all fall down the same. You just gotta ask politely. With a hammer."*

- **Weapon:** a war-maul so heavy it has its own name (*Apology*)
- **Code:** protects those who cannot run, never those who will not
- **Surprise:** he keeps a small, careful garden

Garrick and [Theron Ashbane](#theron-ashbane) fought the Hollow Court together. His maul, *Apology*, was balanced and re-runed by [Kael Ironfist](#kael-ironfist).`,
  },
  {
    meta: {
      id: "lyra-nightshade",
      firstName: "Lyra",
      surname: "Nightshade",
      nationality: "The Undercity",
      gender: "Female",
      age: 31,
      species: "Tiefling",
      archetype: "Rogue",
      element: "Shadow",
      rarity: "Epic",
      title: "The Velvet Knife",
      born: "Year 702 of the Ashen Era",
      accent: "#a78bfa",
    },
    portrait: lyraPortrait,
    stats: [
      { key: "might", label: "Might", value: 54 },
      { key: "agility", label: "Agility", value: 99 },
      { key: "intellect", label: "Intellect", value: 86 },
      { key: "resolve", label: "Resolve", value: 72 },
      { key: "arcana", label: "Arcana", value: 74 },
      { key: "charisma", label: "Charisma", value: 90 },
    ],
    quote: "A locked door is just a question asked politely. I prefer to answer.",
    aliases: ["The Velvet Knife", "Nine-Fingered Lyra"],
    gallery: [SCENES[7], SCENES[6], SCENES[1]],
    relations: [
      { targetId: "mira-corvin", label: "Keeper of secrets" },
      { targetId: "elara-moonwhisper", label: "Owes a life-debt" },
    ],
    theme: { root: 174.61, scale: [0, 2, 3, 5, 7, 9, 10], tempo: 92, wave: "triangle", bass: "sine" },
    biography: `## The Velvet Knife

**Lyra Nightshade** has stolen a king's crown and returned it for the sport of doing so. She keeps a ledger of every secret in the Undercity, and the ledger is worth more than the crown ever was.

### The Page She Should Not Have
Among her trophies is a single torn page from a sorcerer's journal. She cannot read it — it is written in storm — but she knows exactly whose memory it holds, and she will not be giving it back.

> *"Every secret is a key. The trick is finding the door that fears it most."*

- **Method:** poisons that feel like sleep, blades that feel like nothing
- **Rule:** never steals from the poor, never tells the rich why
- **Leverage:** one page of [Mira Corvin's](#mira-corvin) journal

She owes her life to [Elara Moonwhisper](#elara-moonwhisper), a debt the ranger has never called in — which is, Lyra finds, the most unnerving kind of trap.`,
  },
  {
    meta: {
      id: "orin-voidcaller",
      firstName: "Orin",
      surname: "Voidcaller",
      nationality: "The Shrouded Marches",
      gender: "Male",
      age: 52,
      species: "Human",
      archetype: "Warlock",
      element: "Void",
      rarity: "Mythic",
      title: "The Hollow Sage",
      born: "Year 640 of the Ashen Era",
      accent: "#4ade80",
    },
    portrait: orinPortrait,
    stats: [
      { key: "might", label: "Might", value: 40 },
      { key: "agility", label: "Agility", value: 58 },
      { key: "intellect", label: "Intellect", value: 99 },
      { key: "resolve", label: "Resolve", value: 80 },
      { key: "arcana", label: "Arcana", value: 97 },
      { key: "charisma", label: "Charisma", value: 82 },
    ],
    quote: "Death is not an ending. It is merely the page I have most studied.",
    aliases: ["The Hollow Sage", "He Who Counts Souls"],
    gallery: [SCENES[5], SCENES[7], SCENES[0]],
    relations: [
      { targetId: "seraphina-dawn", label: "His mirror in the Light" },
      { targetId: "mira-corvin", label: "Former apprentice" },
    ],
    theme: { root: 130.81, scale: [0, 2, 3, 5, 7, 8, 11], tempo: 66, wave: "sawtooth", bass: "sine" },
    biography: `## The Hollow Sage

**Orin Voidcaller** keeps a candle lit for every soul he has shepherded across the threshold. His tower has no windows because the windows are full of candles. There are *thousands*.

### The Bargain
He did not seek the power to call the dead. The dead sought him — they came, one by one, until speaking with them became as natural as breath, and almost as necessary.

> *"You fear the dark because you cannot count what lives there. I have counted. I am not reassured."*

- **Practice:** necromancy of counsel, not of command — he asks, never compels
- **Missing:** his left hand, taken by his most gifted student
- **Known by:** [Theron Ashbane](#theron-ashbane), who alone knows his true name

He feels [Seraphina Dawn](#seraphina-dawn) the way a candle feels the dawn — with great and patient dread.`,
  },
];
