import { Component, OnInit, Input, ViewChild } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { NgbTooltip } from '@ng-bootstrap/ng-bootstrap';
import { Observable } from 'rxjs/Observable';
import { catchError, map, tap } from 'rxjs/operators';
import { of } from 'rxjs/observable/of';
import 'rxjs/add/observable/forkJoin';
import 'rxjs/add/operator/debounceTime';
import { Character, Item, ItemView, Stat, StatsView } from './gw2-models';

import * as jQuery from 'jquery';
import { PACKAGE_ROOT_URL } from '@angular/core/src/application_tokens';
import * as debounce from 'debounce'
import { FormControl } from '@angular/forms';

const RARITY_TO_CLASS = {
  'Junk': 'gw2-item-junk',
  'Basic': 'gw2-item-basic',
  'Fine': 'gw2-item-fine',
  'Masterwork': 'gw2-item-masterwork',
  'Rare': 'gw2-item-rare',
  'Exotic': 'gw2-item-exotic',
  'Ascended': 'gw2-item-ascended',
  'Legendary': 'gw2-item-legendary'
};

const ITEM_TYPES = [
  //'Armor',
  'Back',
  //'Bag',
  //'Consumable',
  'Container',
  //'CraftingMaterial',
  //'Gathering',
  //'Gizmo',
  //'MiniPet',
  //'Tool',
  //'Trait',
  //'Trinket',
  'Ring',
  'Accessory',
  'Amulet',
  //'Trophy',
  'UpgradeComponent',
  //'Weapon'
];

const ARMOR_TYPES = [
  'Helm',
  'Shoulders',
  'Coat',
  'Gloves',
  'Leggings',
  'Boots'
]

const WEAPON_TYPES = [
  'Axe',
  'Dagger',
  'Mace',
  'Pistol',
  'Scepter',
  'Sword',

  'Focus',
  'Shield',
  'Torch',
  'Warhorn',

  'Greatsword',
  'Hammer',
  'LongBow',
  'Rifle',
  'ShortBow',
  'Staff',

  'Trident',
  'Harpoon',
  'Spear'
]

@Component({
  selector: 'gw2-item',
  templateUrl: './gw2-item.component.html',
  styleUrls: ['./app.component.css']
})
export class GW2Item {
  @Input() itemView: ItemView;
}

class Column {
  name: string;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'app';
  apiKey = new FormControl('');
  characters = [];
  charactersData: Character[];
  itemMap = {}
  bank: ItemView[];
  ascendedMap = {}
  ascendedArmor = {
    Light: this.makeArmorObject(),
    Medium: this.makeArmorObject(),
    Heavy: this.makeArmorObject(),
  }
  ascendedWeapon = this.makeWeaponObject()
  armorTypes = ARMOR_TYPES
  itemTypes = ITEM_TYPES
  weaponTypes = WEAPON_TYPES
  statsMap: {};
  statsViews: Object[];
  allItemViews: ItemView[] = [];

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer) {
  }

  async ngOnInit() {
    let apiKey = localStorage.getItem('apiKey');
    if (apiKey) {
      this.apiKey.setValue(apiKey);
    }
    await this.init();
  }

  async init() {
    if (!this.apiKey.value) {
      return;
    }
    await this.getCharacters();
    await this.getInventories();
    await this.getStatsAndItems();
    await this.getExtStats();
    this.prepareAdditionalData();
  }

  makeArmorObject() {
    return ARMOR_TYPES.reduce((result, item, index, array) => {
      result[item] = [];
      return result;
    }, {});
  }

  makeWeaponObject() {
    return WEAPON_TYPES.reduce((result, item, index, array) => {
      result[item] = [];
      return result;
    }, {});
  }

  async getCharacters() {
    let characters = await this.http.get<string[]>(`https://api.guildwars2.com/v2/characters?access_token=${this.apiKey.value}`).toPromise();
    this.characters = characters;
  }

  async getInventories() {
    let bankPromise = this.http.get<ItemView[]>(`https://api.guildwars2.com/v2/account/bank?access_token=${this.apiKey.value}`).toPromise();

    let promises: Array<Promise<Character>> = [];
    for (let character of this.characters) {
      promises.push(this.http.get<Character>(`https://api.guildwars2.com/v2/characters/${character}?access_token=${this.apiKey.value}`).toPromise());
    }

    this.bank = await bankPromise;
    this.charactersData = await Promise.all(promises);
  }

  walkItemViews(cb: (itemV: ItemView, source: string) => void) {
    for (let characterData of this.charactersData) {
      for (let bag of characterData.bags) {
        if (bag) {
          for (let itemV of bag.inventory) {
            if (itemV) {
              cb(itemV, characterData.name);
            }
          }
        }
      }
      for (let itemV of characterData.equipment) {
        if (itemV) {
          cb(itemV, `${characterData.name} (equipped)`);
        }
      }
    }
    for (let itemV of this.bank) {
      if (itemV) {
        cb(itemV, 'Bank');
      }
    }
  }

  async getStatsAndItems() {
    let itemsIds = [];
    let statsIds = [];
    this.walkItemViews((itemV, source) => {
      itemV.source = source;
      itemsIds.push(itemV.id);
      if (itemV.stats) {
        statsIds.push(itemV.stats.id);
      }
    });

    let promises: Promise<Item[]>[] = [];
    for (let part = 0; part < itemsIds.length / 100 + 1; part++) {
      let partIds = itemsIds.slice(part * 100, part * 100 + 100);
      if (partIds.length) {
        let ids = partIds.join(',');
        promises.push(this.http.get<Item[]>(`https://api.guildwars2.com/v2/items?ids=${ids}`).toPromise());
      }
    }

    let ids = Array.from(new Set(statsIds)).join(',');
    let statsPromise = this.http.get<Stat[]>(`https://api.guildwars2.com/v2/itemstats?ids=${ids}`).toPromise();

    let itemParts = await Promise.all(promises);
    for (let items of itemParts) {
      for (let item of items) {
        item.safeUrl = this.sanitizer.bypassSecurityTrustStyle(`url(${item.icon})`);
        item.rarityClass = RARITY_TO_CLASS[item.rarity];
        this.itemMap[item.id] = item;
      }
    }

    this.statsMap = (await statsPromise).reduce((result, item, index, array) => {
      result[item.id] = item;
      return result;
    }, {});
  }

  async getExtStats() {
    let extStatsIds = new Set();
    this.walkItemViews((itemV, source) => {
      itemV.item = this.itemMap[itemV.id];
      if (itemV.stats) {
        itemV.stats.stat = this.statsMap[itemV.stats.id];
      }
      if (itemV.item) {
        this.allItemViews.push(itemV);

        if (itemV.item.details && itemV.item.details.stat_choices) {
          for (let sc of itemV.item.details.stat_choices) {
            extStatsIds.add(sc);
          }
        }

        if (!itemV.stats && itemV.item.details && itemV.item.details.infix_upgrade) {
          itemV.stats = new StatsView;
          itemV.stats.attributes = {};
          if (itemV.item.details.infix_upgrade.id in this.statsMap) {
            itemV.stats.stat = this.statsMap[itemV.item.details.infix_upgrade.id];
          } else {
            extStatsIds.add(itemV.item.details.infix_upgrade.id);
          }

          for (let attr of itemV.item.details.infix_upgrade.attributes) {
            itemV.stats.attributes[attr.attribute] = attr.modifier;
          }
        }
      }
    });

    if (extStatsIds.size > 0) {
      let ids = Array.from(extStatsIds).join(',');
      let stats = await this.http.get<Stat[]>(`https://api.guildwars2.com/v2/itemstats?ids=${ids}`).toPromise();

      this.statsMap = stats.reduce((result, item, index, array) => {
        result[item.id] = item;
        return result;
      }, {});

      let statsViews = {};
      statsViews['Select'] = {
        'name': 'Select',
        'items': []
      };

      this.walkItemViews((itemV, source) => {
        if (itemV.item && itemV.item.details) {
          if (itemV.stats && !itemV.stats.stat && itemV.item.details.infix_upgrade) {
            itemV.stats.stat = this.statsMap[itemV.item.details.infix_upgrade.id];
          }
          else if (!itemV.stats && itemV.item.details.stat_choices) {
            itemV.selectStats = new Array<Stat>();
            for (let statId of itemV.item.details.stat_choices) {
              itemV.selectStats.push(this.statsMap[statId]);
            }
          }
        }

        if (itemV.item &&
          (itemV.item.rarity == 'Ascended' ||
            itemV.item.rarity == 'Legendary' ||
            itemV.item.rarity == 'Exotic') &&
          itemV.binding == 'Account' &&
          !itemV.source.endsWith('(equipped)')) {
          if (itemV.stats && itemV.stats.stat && itemV.stats.stat.name) {
            let stat = itemV.stats.stat;
            if (!(stat.name in statsViews)) {
              statsViews[stat.name] = stat
              statsViews[stat.name]['items'] = [];
            }
            statsViews[stat.name]['items'].push(itemV);
          }
          else if (itemV.item && itemV.item.details && itemV.item.details.stat_choices) {
            statsViews['Select']['items'].push(itemV);
          }
        }
      });

      this.statsViews = [];
      for (let statName of Object.keys(statsViews)) {
        this.statsViews.push(statsViews[statName]);
      }
    }
  }

  itemFilters: Object;
  itemFiltersControl: Object;
  itemRows: Object[];
  itemColumns: Column[];
  filteredRows: Object[];

  onFilter() {
    this.filteredRows.length = 0;
    for (let row of this.itemRows) {
      let filteredOut = false;
      for (let col of this.itemColumns) {
        if (this.itemFilters[col.name]) {
          if (!row[col.name]) {
            filteredOut = true;
          }
          else if (!row[col.name].match(new RegExp(this.itemFilters[col.name], 'gi'))) {
            filteredOut = true;
          }
        }
      }
      if (!filteredOut)
        this.filteredRows.push(row);
    }
  }

  prepareAdditionalData() {
    this.itemFilters = {};
    this.itemFiltersControl = {};
    this.itemRows = [];
    this.itemColumns = [
      {name: 'name'},
      {name: 'type1'},
      {name: 'type2'},
      {name: 'stat'},
      {name: 'source'},
    ];

    for (let col of this.itemColumns) {
      this.itemFilters[col.name] = '';
      this.itemFiltersControl[col.name] = new FormControl();
      this.itemFiltersControl[col.name].valueChanges
        .debounceTime(500)
        .subscribe(newValue => {
          this.itemFilters[col.name] = newValue;
          this.onFilter();
        });
    }

    for (let itemV of this.allItemViews) {
      this.itemRows.push({
        name: itemV.item.name,
        type1: itemV.item.type,
        type2: itemV.item.details ? itemV.item.details.type : null,
        stat: (itemV.stats && itemV.stats.stat) ? itemV.stats.stat.name : null,
        source: itemV.source,

        class: itemV.item.rarityClass
      })
    }

    this.filteredRows = this.itemRows.slice();

    for (let itemV of this.allItemViews) {
      if ((itemV.item.rarity == 'Ascended' || itemV.item.rarity == 'Legendary' || itemV.item.rarity == 'Exotic') &&
          itemV.binding == 'Account' &&
          !itemV.source.endsWith('(equipped)')) {
        let type = itemV.item.type;
        if (type == 'Trinket') {
          type = itemV.item.details.type;
        }
        if (type == 'Armor') {
          this.ascendedArmor[itemV.item.details.weight_class][itemV.item.details.type].push(itemV);
        } else if (type == 'Weapon') {
          this.ascendedWeapon[itemV.item.details.type].push(itemV);
        } else if (ITEM_TYPES.includes(type)) {
          if (!(type in this.ascendedMap)) {
            this.ascendedMap[type] = [];
          }
          this.ascendedMap[type].push(itemV);
        }
      }
    }
  }

  async updateApiKey() {
    if (this.apiKey.value) {
      localStorage.setItem('apiKey', this.apiKey.value);
      await this.init();
    }
  }

  private log(msg : string) {
    console.log(msg);
  }

  private handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      console.error(error);
      this.log(`${operation} failed: ${error.message}`);
      return of(result as T);
    };
  }

}
