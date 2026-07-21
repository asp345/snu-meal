export type MealType = "BR" | "LU" | "DN";

export interface Manifest {
  schema_version: 2;
  generated_at: string;
  available_dates: string[];
  sources: {
    snuco: number;
    snudorm: number;
    vet: number;
  };
}

export interface Meal {
  price: number | null;
  no_meat: boolean;
  menus: string[];
}

export interface Restaurant {
  code: string;
  name: string;
  fixed_menu: boolean;
  meals: Meal[];
}

export interface Venue {
  name: string | null;
  restaurants: Restaurant[];
}

export interface Building {
  building_number: string;
  venues: Venue[];
}

export interface MealSection {
  type: MealType;
  buildings: Building[];
}

export interface DateMenu {
  date: string;
  types: MealSection[];
}

export interface AppState {
  manifest: Manifest | null;
  dataBase: string;
  selectedDate: string;
  selectedType: MealType;
  includeFixed: boolean;
  currentMenu: DateMenu | null;
  menuCache: Map<string, DateMenu>;
  requestSequence: number;
}
