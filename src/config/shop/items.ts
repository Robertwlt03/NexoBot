export type ShopItemType = 'consumable' | 'upgrade' | 'tool' | 'role';

export interface ShopItemEffect {
    type: string;
    command?: string;
    uses?: number;
    multiplier?: number;
    increase?: number;
    protection?: boolean;
}

export interface ShopItem {
    id: string;
    name: string;
    price: number;
    description: string;
    type: ShopItemType;
    maxQuantity?: number;
    maxLevel?: number;
    cooldown?: number;
    durability?: number | null;
    roleId?: string | null;
    effect: ShopItemEffect;
}

export const shopItems: ShopItem[] = [
    {
        id: 'extra_work',
        name: 'Extraschicht',
        price: 5000,
        description: 'Erlaubt eine zusätzliche Nutzung von `/eco work`.',
        type: 'consumable',
        maxQuantity: 5,
cooldown: 86400000,
        effect: {
            type: 'command_boost',
            command: 'work',
            uses: 1
        }
    },
    {
        id: 'bank_upgrade_1',
        name: 'Bank-Upgrade I',
        price: 15000,
        description: 'Erhöht deine Bankkapazität, damit du mehr einzahlen kannst.',
        type: 'upgrade',
        maxLevel: 5,
        effect: {
            type: 'bank_capacity',
            multiplier: 1.5
        }
    },
    {
        id: 'diamond_pickaxe',
        name: 'Diamantspitzhacke',
        price: 50000,
        description: 'Erhöht den Ertrag von `/eco mine`',
        type: 'tool',
        durability: 100,
        effect: {
            type: 'mining_yield',
            multiplier: 2.0
        }
    },
    {
        id: 'premium_role',
        name: 'Premium-Serverrolle',
        price: 15000,
        description: 'Eine besondere Rolle mit schicker Farbe und 10 % Daily-Bonus.',
        type: 'role',
roleId: null,
        effect: {
            type: 'daily_bonus',
            multiplier: 1.1
        }
    },
    {
        id: 'lucky_clover',
        name: 'Glücksklee',
        price: 10000,
        description: 'Erhöht einmalig die Chance auf einen höheren Gewinn bei `/eco gamble`.',
        type: 'consumable',
        maxQuantity: 10,
        effect: {
            type: 'gamble_boost',
            multiplier: 1.5,
            uses: 1
        }
    },
    {
        id: 'fishing_rod',
        name: '🎣 Angel',
        price: 5000,
        description: 'Wird für Angel-Commands benötigt',
        type: 'tool',
        durability: 100,
        effect: {
            type: 'fishing_yield',
            multiplier: 1.0
        }
    },
    {
        id: 'pickaxe',
        name: '⛏️ Spitzhacke',
        price: 7500,
        description: 'Wird für Bergbau-Commands benötigt',
        type: 'tool',
        durability: 100,
        effect: {
            type: 'mining_yield',
            multiplier: 1.2
        }
    },
    {
        id: 'laptop',
        name: '💻 Laptop',
        price: 15000,
        description: 'Erhöht deine Einnahmen beim Arbeiten',
        type: 'tool',
        durability: 200,
        effect: {
            type: 'work_yield',
            multiplier: 1.5
        }
    },
    {
        id: 'lucky_charm',
        name: '🍀 Glücksbringer',
        price: 10000,
        description: 'Erhöht dein Glück beim Glücksspiel. Hält 3 Nutzungen lang.',
        type: 'consumable',
        maxQuantity: 10,
        effect: {
            type: 'gamble_boost',
            multiplier: 1.3,
            uses: 3
        }
    },
    {
        id: 'bank_note',
        name: '📜 Bankschein',
        price: 25000,
        description: 'Erhöht deine Bankkapazität um 10.000. Mehrfach kaufbar.',
        type: 'tool',
        durability: null,
        effect: {
            type: 'bank_capacity',
            increase: 10000
        }
    },
    {
        id: 'personal_safe',
        name: '🔒 Persönlicher Tresor',
        price: 30000,
        description: 'Schützt dein Geld vor Diebstahl. Andere können dich nicht mehr ausrauben.',
        type: 'tool',
        durability: null,
        effect: {
            type: 'robbery_protection',
            protection: true
        }
    }
];