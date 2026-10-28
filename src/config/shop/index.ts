import { botConfig } from '../bot.js';

const { currency } = botConfig.economy;

export const shopConfig = {
    name: 'Nexo Shop',
    currency: currency.name,
    currencyName: currency.name,
    currencyNamePlural: currency.namePlural || `${currency.name}s`,
    currencySymbol: currency.symbol || '💵',
    
    categories: [
        {
            id: 'consumables',
            name: 'Verbrauchsgüter',
            description: 'Einmal nutzbare Items mit zeitlich begrenzten Vorteilen',
            icon: '🍯',
            itemTypes: ['consumable']
        },
        {
            id: 'upgrades',
            name: 'Upgrades',
            description: 'Dauerhafte Upgrades, die deine Fähigkeiten verbessern',
            icon: '⚡',
            itemTypes: ['upgrade']
        },
        {
            id: 'tools',
            name: 'Werkzeuge',
            description: 'Ausrüstung, mit der du Ressourcen effizienter sammelst',
            icon: '⛏️',
            itemTypes: ['tool']
        },
        {
            id: 'roles',
            name: 'Rollen',
            description: 'Besondere Rollen mit einzigartigen Vorteilen',
            icon: '🎭',
            itemTypes: ['role']
        }
    ],
    
    transaction: {
cooldown: 1000,
maxQuantity: 10,
confirmTimeout: 30000,
        
        refundPolicy: {
            enabled: true,
window: 300000,
fee: 0.1
        }
    },
    
    ui: {
        itemsPerPage: 5,
        showOutOfStock: true,
        showOwnedItems: true,
        showAffordability: true,
        
        colors: {
primary: '#5865F2',
success: '#43B581',
error: '#F04747',
warning: '#FAA61A',
info: '#00B0F4',
            
            rarity: {
common: '#99AAB5',
uncommon: '#2ECC71',
rare: '#3498DB',
epic: '#9B59B6',
legendary: '#F1C40F',
mythic: '#E74C3C'
            }
        },
        
        emojis: {
            currency: '🪙',
            quantity: '✖️',
            price: '💵',
            owned: '✅',
            outOfStock: '❌',
            
            types: {
                consumable: '🍯',
                upgrade: '⚡',
                tool: '⛏️',
                role: '🎭'
            }
        }
    },
    
    events: {
        restock: {
            enabled: true,
interval: 86400000,
announcementChannel: null as string | null,
            message: '🛒 **Shop aufgefüllt!** Neue Items sind jetzt verfügbar!'
        },
        
        sales: {
            enabled: true,
            schedule: [
                {
day: 0,
discount: 0.2,
                    message: '🔥 **Wochenend-Sale!** 20 % Rabatt auf alle Items!'
                },
            ]
        }
    }
};