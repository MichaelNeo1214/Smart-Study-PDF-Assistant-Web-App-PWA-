export interface Flashcard {
  front: string;
  back: string;
  tag?: string;
}

export interface StudyDeck {
  id: string;
  uid: string;
  title: string;
  source: string;
  cards: Flashcard[];
  createdAt?: number;
  updatedAt?: number;
}

export interface StudyNote {
  id: string;
  uid: string;
  title: string;
  content: string;
  createdAt?: number;
  updatedAt?: number;
}
