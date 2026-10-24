// Questions for the quiz duel (/fun spiel quiz): general knowledge, German, four answers, the first one correct
// (shuffled when asked).

export interface QuizQuestion { q: string; a: [string, string, string, string] }

export const QUIZ: QuizQuestion[] = [
  { q: 'Wie viele Beine hat eine Spinne?', a: ['8', '6', '10', '12'] },
  { q: 'Welcher Planet ist der Sonne am nächsten?', a: ['Merkur', 'Venus', 'Mars', 'Erde'] },
  { q: 'Wie heißt die Hauptstadt von Kanada?', a: ['Ottawa', 'Toronto', 'Vancouver', 'Montreal'] },
  { q: 'Wie viele Minuten hat ein Tag?', a: ['1440', '1200', '1640', '960'] },
  { q: 'Welches Tier ist das größte der Welt?', a: ['Blauwal', 'Afrikanischer Elefant', 'Pottwal', 'Walhai'] },
  { q: 'Aus welchem Land kommt die Pizza Margherita?', a: ['Italien', 'Spanien', 'Griechenland', 'Frankreich'] },
  { q: 'Wie viele Saiten hat eine klassische Gitarre?', a: ['6', '4', '7', '12'] },
  { q: 'Welches chemische Zeichen steht für Gold?', a: ['Au', 'Ag', 'Go', 'Gd'] },
  { q: 'Wer malte die Mona Lisa?', a: ['Leonardo da Vinci', 'Michelangelo', 'Raffael', 'Vincent van Gogh'] },
  { q: 'Wie heißt der längste Fluss Deutschlands (in Deutschland)?', a: ['Rhein', 'Elbe', 'Donau', 'Main'] },
  { q: 'Wie viele Kontinente gibt es?', a: ['7', '5', '6', '8'] },
  { q: 'Welches Gas brauchen Pflanzen für die Fotosynthese?', a: ['Kohlendioxid', 'Sauerstoff', 'Stickstoff', 'Helium'] },
  { q: 'In welchem Jahr fiel die Berliner Mauer?', a: ['1989', '1990', '1987', '1991'] },
  { q: 'Wie viele Spieler hat eine Fußballmannschaft auf dem Feld?', a: ['11', '10', '9', '12'] },
  { q: 'Welche Farbe entsteht aus Blau und Gelb?', a: ['Grün', 'Lila', 'Orange', 'Braun'] },
  { q: 'Was ist der höchste Berg der Welt?', a: ['Mount Everest', 'K2', 'Kilimandscharo', 'Mont Blanc'] },
  { q: 'Wie viele Ecken hat ein Oktagon?', a: ['8', '6', '10', '12'] },
  { q: 'Wie heißt das Spiel, in dem man Blöcke abbaut und Creeper explodieren?', a: ['Minecraft', 'Terraria', 'Roblox', 'Fortnite'] },
  { q: 'Welcher Ozean ist der größte?', a: ['Pazifik', 'Atlantik', 'Indischer Ozean', 'Arktischer Ozean'] },
  { q: 'Wie viele Herzen hat ein Oktopus?', a: ['3', '1', '2', '8'] },
  { q: 'Welche Sprache spricht man in Brasilien?', a: ['Portugiesisch', 'Spanisch', 'Brasilianisch', 'Englisch'] },
  { q: 'Was misst ein Thermometer?', a: ['Temperatur', 'Luftdruck', 'Feuchtigkeit', 'Windstärke'] },
  { q: 'Wie heißt der Erfinder der Glühbirne, der sie bekannt machte?', a: ['Thomas Edison', 'Nikola Tesla', 'Albert Einstein', 'Isaac Newton'] },
  { q: 'Wie viele Tasten hat ein klassisches Klavier?', a: ['88', '76', '92', '64'] },
  { q: 'Welches Tier legt die größten Eier?', a: ['Strauß', 'Emu', 'Pinguin', 'Krokodil'] },
  { q: 'Wie heißt die Hauptstadt von Australien?', a: ['Canberra', 'Sydney', 'Melbourne', 'Perth'] },
  { q: 'Welches Organ pumpt das Blut durch den Körper?', a: ['Herz', 'Lunge', 'Leber', 'Niere'] },
  { q: 'Wie viele Bits hat ein Byte?', a: ['8', '4', '16', '10'] },
  { q: 'Was ist H₂O?', a: ['Wasser', 'Wasserstoff', 'Salz', 'Sauerstoff'] },
  { q: 'Wer schrieb „Faust“?', a: ['Johann Wolfgang von Goethe', 'Friedrich Schiller', 'Heinrich Heine', 'Thomas Mann'] },
  { q: 'Wie viele Zähne hat ein erwachsener Mensch normalerweise?', a: ['32', '28', '30', '36'] },
  { q: 'Welche Stadt nennt man die „Stadt der Liebe“?', a: ['Paris', 'Venedig', 'Rom', 'Wien'] },
  { q: 'Was ist das kleinste Bundesland Deutschlands?', a: ['Bremen', 'Saarland', 'Hamburg', 'Berlin'] },
  { q: 'Wie viele Farben hat ein Regenbogen üblicherweise?', a: ['7', '5', '6', '8'] },
  { q: 'Welches Metall ist bei Zimmertemperatur flüssig?', a: ['Quecksilber', 'Blei', 'Zinn', 'Aluminium'] },
  { q: 'Wofür steht „www“?', a: ['World Wide Web', 'World Web Wide', 'Wide World Web', 'Web World Wide'] },
  { q: 'Wie heißt der Stern im Zentrum unseres Sonnensystems?', a: ['Sonne', 'Sirius', 'Polarstern', 'Alpha Centauri'] },
  { q: 'Wie viele Sekunden hat eine Stunde?', a: ['3600', '600', '6000', '360'] },
  { q: 'Welches Tier ist das Wappentier Deutschlands?', a: ['Adler', 'Löwe', 'Bär', 'Falke'] },
  { q: 'Wie heißt das Pokémon mit der Nummer 25?', a: ['Pikachu', 'Glumanda', 'Bisasam', 'Evoli'] },
];

/** `count` different questions with their answers shuffled; `correct` is the index of the right answer. */
export function pickQuestions(count: number, random: () => number = Math.random): { q: string; answers: string[]; correct: number }[] {
  const pool = [...QUIZ];
  const picked: { q: string; answers: string[]; correct: number }[] = [];
  while (picked.length < count && pool.length) {
    const { q, a } = pool.splice(Math.floor(random() * pool.length), 1)[0];
    const order = [0, 1, 2, 3].sort(() => random() - 0.5);
    picked.push({ q, answers: order.map((i) => a[i]), correct: order.indexOf(0) });
  }
  return picked;
}
