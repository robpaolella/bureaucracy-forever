/**
 * The game's encounter ids (ADDON-SPEC.md section 3.1): the id `ENCOUNTER_END` reports for a boss
 * kill, so the add-on can match a kill by id in any client language.
 *
 * Source: wago.tools DungeonEncounter table, WoW Forever client build 1.60.1.70374
 * (https://wago.tools/db2/DungeonEncounter/csv?build=1.60.1.70374), column `ID`, grouped by
 * `MapID`, which is the raid template's `instance` number. Names are the English `Name_lang`.
 * The two non-instance maps (0 and 13) are left out. Generated; refresh from a newer build rather than editing by hand. A boss name that occurs
 * more than once on a map (a dungeon's per-difficulty rows) is left out, because one name
 * cannot say which id the game reports; such a boss is matched by name instead.
 */
const ENCOUNTERS: Record<number, [name: string, id: number][]> = {
  // Shadowfang Keep
  33: [
    ['Rethilgore', 2748],
    ['Razorclaw the Butcher', 2749],
    ['Baron Silverlaine', 2750],
    ['Commander Springvale', 2751],
    ['Odo the Blindwatcher', 2752],
    ['Fenrus the Devourer', 2753],
    ['Wolf Master Nandos', 2754],
    ['Archmage Arugal', 2755],
  ],
  // Stormwind Stockade
  34: [
    ['Targorr the Dread', 2756],
    ['Kam Deepfury', 2757],
    ['Hamhock', 2758],
    ['Dextren Ward', 2759],
    ['Bazil Thredd', 2760],
  ],
  // Deadmines
  36: [
    ["Rhahk'Zor", 2741],
    ['Sneed', 2742],
    ['Gilnid', 2743],
    ['Captain Greenskin', 2744],
    ['Mr. Smite', 2745],
    ['Cookie', 2746],
    ['Edwin VanCleef', 2747],
    ['Miner Johnson', 3676],
  ],
  // Wailing Caverns
  43: [
    ['Lady Anacondra', 585],
    ['Lord Cobrahn', 586],
    ['Kresh', 587],
    ['Lord Pythas', 588],
    ['Skum', 589],
    ['Lord Serpentis', 590],
    ['Verdan the Everliving', 591],
    ['Mutanus the Devourer', 592],
  ],
  // Razorfen Kraul
  47: [
    ['Roogug', 2773],
    ['Aggem Thorncurse', 2774],
    ['Death Speaker Jargba', 2775],
    ['Overlord Ramtusk', 2776],
    ['Agathelos the Raging', 2777],
    ['Charlga Razorflank', 2778],
  ],
  // Blackfathom Deeps
  48: [
    ['Baron Aquanis', 2694],
    ['Gelihast', 2704],
  ],
  // Uldaman
  70: [
    ['Revelosh', 547],
    ['The Lost Dwarves', 548],
    ['Ironaya', 549],
    ['Ancient Stone Keeper', 551],
    ['Galgann Firehammer', 552],
    ['Grimlok', 553],
    ['Archaedas', 554],
    ['Obsidian Sentinel', 1887],
  ],
  // Gnomeregan
  90: [
    ['Mechanical Menagerie', 2935],
  ],
  // Sunken Temple
  109: [
    ['Festering Rotslime', 2953],
    ["Atal'ai Defenders", 2954],
    ['Dreamscythe and Weaver', 2955],
    ["Jammal'an and Ogom", 2957],
    ['Morphaz and Hazzas', 2958],
  ],
  // Razorfen Downs
  129: [
    ["Tuten'kash", 2780],
    ['Plaguemaw the Rotting', 2781],
    ['Mordresh Fire Eye', 2782],
    ['Ragglesnout', 2783],
    ['Glutton', 2784],
    ['Amnennar the Coldbringer', 2785],
  ],
  // Scarlet Monastery
  189: [
    ['Interrogator Vishas', 444],
    ['Houndmaster Loksey', 446],
    ['Arcanist Doan', 447],
    ['Herod', 448],
    ['High Inquisitor Fairbanks', 449],
    ['High Inquisitor Whitemane', 450],
    ['Bloodmage Thalnos', 2779],
  ],
  // Zul'Farrak
  209: [
    ['Hydromancer Velratha', 593],
    ["Gahz'rilla", 594],
    ["Antu'sul", 595],
    ['Theka the Martyr', 596],
    ["Witch Doctor Zum'rah", 597],
    ['Nekrum Gutchewer', 598],
    ["Shadowpriest Sezz'ziz", 599],
    ['Chief Ukorz Sandscalp', 600],
  ],
  // Blackrock Spire
  229: [
    ['Highlord Omokk', 267],
    ["Shadow Hunter Vosh'gajin", 268],
    ['War Master Voone', 269],
    ['Mother Smolderweb', 270],
    ['Urok Doomhowl', 271],
    ['Quartermaster Zigris', 272],
    ['Gizrul the Slavener', 273],
    ['Halycon', 274],
    ['Overlord Wyrmthalak', 275],
    ['Pyroguard Emberseer', 3062],
    ['Warchief Rend Blackhand', 3063],
    ['The Beast', 3068],
    ['General Drakkisath', 3069],
    ['Lord Valthalak', 3070],
  ],
  // Blackrock Depths
  230: [
    ['High Interrogator Gerstahn', 227],
    ['Lord Roccor', 228],
    ['Houndmaster Grebmar', 229],
    ['Ring of Law', 230],
    ['Pyromancer Loregrain', 231],
    ['Lord Incendius', 232],
    ['Warder Stilgiss', 233],
    ['Fineous Darkvire', 234],
    ["Bael'Gar", 235],
    ['General Angerforge', 236],
    ['Golem Lord Argelmach', 237],
    ['Hurley Blackbreath', 238],
    ['Phalanx', 239],
    ['Ribbly Screwspigot', 240],
    ['Plugger Spazzring', 241],
    ['Ambassador Flamelash', 242],
    ['The Seven', 243],
    ['Magmus', 244],
    ['Princess Moira Bronzebeard', 2789],
    ['Emperor Dagran Thaurissan', 2790],
    ['The Vault', 2791],
  ],
  // Onyxia's Lair
  249: [
    ['Onyxia', 1084],
  ],
  // Scholomance
  289: [
    ['Darkmaster Gandling', 2801],
    ['Doctor Theolen Krastinov', 2802],
    ['Instructor Malicia', 2803],
    ['Jandice Barov', 2804],
    ['Kirtonos', 2805],
    ['Lady Illucia Barov', 2806],
    ['Lord Alexei Barov', 2807],
    ['Lorekeeper Polkelt', 2808],
    ['Marduk Blackpool', 2809],
    ['Ras Frostwhisperer', 2810],
    ['Rattlegore', 2811],
    ['The Ravenian', 2812],
    ['Vectus', 2813],
    ['Kormok', 3055],
  ],
  // Zul'Gurub
  309: [
    ['High Priest Venoxis', 784],
    ['High Priestess Jeklik', 785],
    ["High Priestess Mar'li", 786],
    ['Bloodlord Mandokir', 787],
    ['Edge of Madness', 788],
    ['High Priest Thekal', 789],
    ["Gahz'ranka", 790],
    ['High Priestess Arlokk', 791],
    ["Jin'do the Hexxer", 792],
    ['Hakkar', 793],
  ],
  // Stratholme
  329: [
    ['The Unforgiven', 472],
    ['Hearthsinger Forresten', 473],
    ['Timmy the Cruel', 474],
    ['Cannon Master Willey', 475],
    ['Malor the Zealous', 476],
    ['Archivist Galford', 477],
    ['Balnazzar', 478],
    ['Baroness Anastari', 479],
    ["Nerub'enkan", 480],
    ['Maleki the Pallid', 481],
    ['Magistrate Barthilas', 482],
    ['Ramstein the Gorger', 483],
    ['Baron Rivendare', 484],
    ['Black Guard Swordsmith', 2795],
    ['Crimson Hammersmith', 2796],
    ['Ezra Grimm', 2797],
    ['Postmaster Malown', 2798],
    ['Skul', 2799],
    ['Stonespine', 2800],
  ],
  // Maraudon
  349: [
    ['Noxxion', 422],
    ['Razorlash', 423],
    ['Lord Vyletongue', 424],
    ['Celebras the Cursed', 425],
    ['Landslide', 426],
    ['Tinkerer Gizlock', 427],
    ['Rotgrip', 428],
    ['Princess Theradras', 429],
  ],
  // Ragefire Chasm
  389: [
    ['Oggleflint', 2732],
    ['Taragaman the Hungerer', 2733],
    ['Jergosh the Invoker', 2734],
    ['Bazzalan', 2735],
  ],
  // Molten Core
  409: [
    ['Lucifron', 663],
    ['Magmadar', 664],
    ['Gehennas', 665],
    ['Garr', 666],
    ['Shazzrah', 667],
    ['Baron Geddon', 668],
    ['Sulfuron Harbinger', 669],
    ['Golemagg the Incinerator', 670],
    ['Majordomo Executus', 671],
    ['Ragnaros', 672],
    ['The Molten Core', 3018],
  ],
  // Dire Maul
  429: [
    ['Zevrim Thornhoof', 343],
    ['Hydrospawn', 344],
    ['Lethtendris', 345],
    ['Alzzin the Wildshaper', 346],
    ['Illyanna Ravenoak', 347],
    ['Magister Kalendris', 348],
    ["Immol'thar", 349],
    ['Tendris Warpwood', 350],
    ['Prince Tortheldrin', 361],
    ["Guard Mol'dar", 362],
    ['Stomper Kreeg', 363],
    ['Guard Fengus', 364],
    ["Guard Slip'kik", 365],
    ['Captain Kromcrush', 366],
    ["Cho'Rush the Observer", 367],
    ['King Gordok', 368],
    ['Pusillin', 2792],
    ["Lord Hel'nurath", 2793],
    ["Tsu'zee", 2794],
  ],
  // Blackwing Lair
  469: [
    ['Razorgore the Untamed', 610],
    ['Vaelastrasz the Corrupt', 611],
    ['Broodlord Lashlayer', 612],
    ['Firemaw', 613],
    ['Ebonroc', 614],
    ['Flamegor', 615],
    ['Chromaggus', 616],
    ['Nefarian', 617],
  ],
  // Ruins of Ahn'Qiraj
  509: [
    ['Kurinnaxx', 718],
    ['General Rajaxx', 719],
    ['Moam', 720],
    ['Buru the Gorger', 721],
    ['Ayamiss the Hunter', 722],
    ['Ossirian the Unscarred', 723],
  ],
  // Ahn'Qiraj Temple
  531: [
    ['The Prophet Skeram', 709],
    ['Silithid Royalty', 710],
    ['Battleguard Sartura', 711],
    ['Fankriss the Unyielding', 712],
    ['Viscidus', 713],
    ['Princess Huhuran', 714],
    ['Twin Emperors', 715],
    ['Ouro', 716],
    ["C'thun", 717],
  ],
  // Naxxramas
  533: [
    ["Anub'Rekhan", 1107],
    ['Gluth', 1108],
    ['Gothik the Harvester', 1109],
    ['Grand Widow Faerlina', 1110],
    ['Grobbulus', 1111],
    ['Heigan the Unclean', 1112],
    ['Instructor Razuvious', 1113],
    ["Kel'Thuzad", 1114],
    ['Loatheb', 1115],
    ['Maexxna', 1116],
    ['Noth the Plaguebringer', 1117],
    ['Patchwerk', 1118],
    ['Sapphiron', 1119],
    ['Thaddius', 1120],
    ['The Four Horsemen', 1121],
  ],
  // The Searing Basin
  2720: [
    ['Testwerk', 3025],
  ],
  // Demon Fall Canyon
  2784: [
    ['Grimroot', 3023],
    ['Diathorus the Seeker', 3024],
    ["Destructor's Wraith", 3028],
    ['Zilbagob', 3029],
    ['Pyranis', 3030],
    ["Hellscream's Phantom", 3031],
    ['Azgaloth', 3080],
  ],
  // The Tainted Scar
  2789: [
    ['Lord Kazzak', 3026],
  ],
  // Storm Cliffs
  2791: [
    ['Azuregos', 3027],
  ],
  // The Crystal Vale
  2804: [
    ['Prince Thunderaan', 3079],
  ],
  // Nightmare Grove
  2832: [
    ['Emeriss', 3111],
    ['Lethon', 3112],
    ['Taerar', 3113],
    ['Ysondre', 3114],
  ],
  // Scarlet Enclave
  2856: [
    ['Balnazzar', 3185],
    ['Solistrasza', 3186],
    ['Beatrix', 3187],
    ['Reborn Council', 3188],
    ['Caldoran', 3189],
    ['Lillian Voss', 3190],
    ['Beastmaster', 3196],
    ['Mason', 3197],
  ],
  // Karazhan Crypts
  2875: [
    ['Harbinger of Sin', 3141],
    ['Kharon', 3143],
    ['Three Little Wolves', 3144],
    ['Dark Rider', 3145],
    ['Creeping Malison', 3146],
    ["Unk'omon", 3152],
    ['Hans and Greta', 3168],
    ['The Ugly Goblin', 3169],
    ['Kaigy Maryla', 3170],
    ['Sairuh Maryla', 3171],
    ['Barian Maryla', 3172],
  ],
  // Naxxramas
  2921: [
    ['Spirit of Mograine', 3296],
  ],
  // City of Dalaran
  2959: [
    ['Arcane Anomaly', 3298],
    ['Fel Ancient', 3299],
    ['Mana Devourer', 3300],
    ['Mana Elemental', 3301],
    ['Unstable Sentinel', 3302],
    ['Shade of the Archmage', 3303],
    ['Lyn the Ignored', 3310],
    ['Atrexis the Grave Knight', 3311],
    ['Mana Wraith', 3312],
  ],
  // Excavation Site: Wetlands
  2998: [
    ['Saltspine', 3480],
    ['Shadetooth', 3481],
    ['Relic Guardian', 3482],
    ['Highland Horror', 3644],
  ],
  // Ruins of Lordaeron
  2999: [
    ['Witherfang', 3353],
    ["Rath'mael", 3354],
    ['The Butcher', 3355],
    ['The Abandoned', 3357],
    ['Lordaeron Captain', 3408],
    ['Viktor the Vile', 3411],
    ['Bjork', 3412],
  ],
  // (unnamed map)
  3002: [
    ['Deathulus', 3369],
    ['Crushfist Bloodbreaker', 3371],
  ],
  // The Hall of Thanes
  3065: [
    ['Faldrim Anvilmar', 3493],
    ['Plunder', 3494],
    ['Infurnus', 3495],
    ['Durgen Dirgehammer', 3496],
  ],
};

/**
 * The names `ENCOUNTERS` leaves out because a map has them more than once (same build and
 * source). They have no single id, but they are the game's names: the boss-name check treats them as matched.
 */
const DUPLICATE_NAMES: Record<number, string[]> = {
  // Blackfathom Deeps
  48: ['Ghamoo-ra', 'Lady Sarevess', 'Lorgus Jett', 'Geilhast', "Old Serra'kis", 'Twilight Lord Kelris', "Aku'mai"],
  // Gnomeregan
  90: ['Grubbis', 'Viscous Fallout', 'Electrocutioner 6000', 'Crowd Pummeler 9-60', 'Mekgineer Thermaplugg'],
  // Sunken Temple
  109: ['Dreamscythe', 'Weaver', "Jammal'an the Prophet", 'Morphaz', 'Hazzas', 'Avatar of Hakkar', 'Shade of Eranikus', "Atal'alarion"],
};

/** A boss name as compared: case and spacing ignored (the add-on's name matching does the same). */
const key = (name: string) => name.replace(/\s+/g, '').toLowerCase();

const BY_MAP = new Map<number, Map<string, number>>(
  Object.entries(ENCOUNTERS).map(([map, rows]) => [Number(map), new Map(rows.map(([name, id]) => [key(name), id]))]),
);

/** Every table entry, for the tests. */
export const ENCOUNTER_ROWS = Object.entries(ENCOUNTERS).flatMap(([map, rows]) => rows.map(([name, id]) => ({ map: Number(map), name, id })));

/** The encounter id for a boss on a raid map (the template's `instance`), or undefined when unknown. */
export function encounterId(instance: number | null | undefined, bossName: string): number | undefined {
  if (!instance) return undefined;
  return BY_MAP.get(instance)?.get(key(bossName));
}

/** What the Load table's WoW Forever preview says about boss names: not checkable, or the rows to flag and the game's names no row used. */
export type BossNameCheck =
  | { kind: 'unchecked'; reason: 'no-instance' | 'not-listed' }
  | { kind: 'checked'; flagged: string[]; unmatched: string[] };

/** Compares each non-trash row's name with the game's encounter names for the instance (same comparison as `encounterId`; a name the map has twice counts as matched). */
export function checkBossNames(instance: number | null | undefined, rows: { name: string; isTrash: boolean }[]): BossNameCheck {
  if (!instance) return { kind: 'unchecked', reason: 'no-instance' };
  const names = ENCOUNTERS[instance];
  if (!names) return { kind: 'unchecked', reason: 'not-listed' };
  const known = BY_MAP.get(instance)!;
  const bosses = rows.filter((row) => !row.isTrash);
  const duplicates = new Set((DUPLICATE_NAMES[instance] ?? []).map(key));
  const flagged = bosses.filter((row) => !known.has(key(row.name)) && !duplicates.has(key(row.name))).map((row) => row.name);
  const used = new Set(bosses.map((row) => key(row.name)));
  return { kind: 'checked', flagged, unmatched: names.map(([name]) => name).filter((name) => !used.has(key(name))) };
}
