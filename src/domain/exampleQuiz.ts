import type { Quiz } from "./quiz";

const questions: [string, string[], number, string][] = [
  ["Welches Tier schläft manchmal im Stehen?", ["Pferd", "Igel", "Otter", "Koala"], 0, "Pferde können dank einer besonderen Vorrichtung in den Beinen im Stehen dösen."],
  ["Welcher Planet ist als Roter Planet bekannt?", ["Venus", "Mars", "Neptun", "Merkur"], 1, "Eisenoxide verleihen dem Mars seine rötliche Farbe."],
  ["Wie viele Herzen hat ein Oktopus?", ["Eins", "Zwei", "Drei", "Vier"], 2, "Zwei Herzen versorgen die Kiemen, eines den Körper."],
  ["Welche Frucht wächst an einer Staude?", ["Apfel", "Banane", "Kirsche", "Birne"], 1, "Die Bananenpflanze ist eine große krautige Pflanze."],
  ["Was misst ein Barometer?", ["Luftdruck", "Temperatur", "Lautstärke", "Windrichtung"], 0, "Ein Barometer misst den Luftdruck."],
  ["Welches Instrument hat üblicherweise 88 Tasten?", ["Gitarre", "Trompete", "Klavier", "Violine"], 2, "Ein modernes Klavier hat üblicherweise 88 Tasten."],
  ["Wie nennt man die Verwandlung einer Raupe zum Schmetterling?", ["Migration", "Metamorphose", "Rotation", "Fotosynthese"], 1, "Metamorphose bezeichnet die Gestaltveränderung während der Entwicklung."],
  ["Welcher Ozean ist der größte?", ["Atlantischer Ozean", "Indischer Ozean", "Arktischer Ozean", "Pazifischer Ozean"], 3, "Der Pazifik ist der größte Ozean der Erde."],
  ["Welches dieser Tiere ist ein Säugetier?", ["Delfin", "Hai", "Forelle", "Krake"], 0, "Delfine atmen Luft und säugen ihre Jungen."],
  ["Welche Farbe entsteht beim Mischen von Blau und Gelb?", ["Rot", "Grün", "Violett", "Orange"], 1, "Bei gewöhnlichen Malfarben ergibt Blau mit Gelb Grün."],
];

export const exampleQuiz: Quiz = {
  title: "Die große RateLama-Runde",
  description: "Zehn bunte Fragen für einen unterhaltsamen Einstieg.",
  questions: questions.map(([text, answers, correctIndex, explanation]) => ({
    text,
    answers: answers.map((answer, index) => ({ text: answer, correct: index === correctIndex })),
    durationSeconds: 20,
    explanation,
  })),
};
