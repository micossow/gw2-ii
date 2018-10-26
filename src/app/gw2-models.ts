import { SafeStyle } from "@angular/platform-browser";

export class Infix {
  id: number;
  attributes: Array<any>;
}

export class ItemDetails {
  infix_upgrade: Infix;
  stat_choices: Array<number>;
  type: string;
  weight_class: string;  
}

export class Item {
  id: number;
  icon: string;
  rarity: string;
  type: string;
  name: string;

  safeUrl: SafeStyle;
  rarityClass: string;
  details: ItemDetails;
}

export class Stat {
  id: number;
  name: string;
  attributes: Object;
}

export class StatsView {
  id: number;
  stat: Stat;
  attributes: Object;
}

export class ItemView {
  id: number;
  count: number;
  binding: string;
  item: Item;
  source: string;

  infusions: Array<any>;
  upgrades: Array<any>;
  stats: StatsView;
  selectStats: Array<Stat>;
}

//export class EquipmentView {
//  id: number;
//  item: Item;
//}

//export class BankView {
//  id: number;
//  item: Item;
//}

export class Bag {
  id: number;
  inventory: ItemView[];
}

export class Character {
  name: string;
  profession: string;
  race: string;
  bags: Bag[];
  equipment: ItemView[];
}
