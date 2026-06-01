/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpouseDetail {
  name: string;
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string;
  deathPlace?: string;
  burialPlace?: string;
  residence?: string;
  lunarAnniversary?: string;
  phone1?: string;
  phone2?: string;
  phone3?: string;
  isLiving?: boolean;
  solarBirthDate?: string;
  solarDeathDate?: string;
  birthDateStructured?: GenealogyDateStructured;
  deathDateStructured?: GenealogyDateStructured;
  deathAnniversaryLunarStructured?: GenealogyDateStructured;
  email?: string;
}

export interface GenealogyDateStructured {
  calendar: 'solar' | 'lunar' | 'unknown';
  precision: 'full_date' | 'day_month' | 'month_year' | 'year' | 'approximate' | 'unknown';
  day: number | null;
  month: number | null;
  year: number | null;
  rawText: string;
  certainty: 'verified' | 'candidate' | 'uncertain';
  sourceId?: string;
  chunkId?: string;
  isLeapMonth?: boolean;
}

export interface AncestorNode {
  id: string;
  name: string;
  generation: number;
  title?: string;
  rankRole?: string; // Vai vế / Danh xưng chính (Trưởng chi, Trưởng tộc, Đích tôn...)
  customSuffix?: string; // Tước vị / Học hàm / Chức danh xã hội khác
  birthYear?: string;
  deathYear?: string;
  birthPlace?: string; // Nơi sinh chi tiết
  deathPlace?: string; // Nơi mất chi tiết
  description?: string;
  bio?: string;
  achievements?: string[];
  spouse?: string; // Standard or multi-spouse comma separated
  spouseList?: string[]; // Structured spouse array for better selection dropdowns
  spouseDetails?: SpouseDetail[]; // Rich detailed spouses
  children?: AncestorNode[];
  parentId?: string;
  branch?: string;
  residence?: string; // Nơi cư trú
  burialPlace?: string; // Nơi an táng
  lunarAnniversary?: string; // Ngày giỗ Âm lịch
  motherName?: string; // Con của vợ nào
  isLiving?: boolean; // Người còn sống
  phone1?: string; // Điện thoại liên lạc 1
  phone2?: string; // Điện thoại liên lạc 2
  phone3?: string; // Điện thoại liên lạc 3
  solarBirthDate?: string; // Ngày sinh dương lịch
  solarDeathDate?: string; // Ngày mất dương lịch
  email?: string; // Email liên lạc
  birthDateStructured?: GenealogyDateStructured;
  deathDateStructured?: GenealogyDateStructured;
  deathAnniversaryLunarStructured?: GenealogyDateStructured;
  photo?: string; // Anh chan dung hoac avatar
  gender?: 'nam' | 'nữ'; // Giới tính (Nam/Nữ)
}

export interface LineageNews {
  id: string;
  title: string;
  category: 'thong_bao' | 'hoat_dong' | 'su_kien' | 'dong_gop';
  summary: string;
  content: string;
  imageUrl?: string;
  date: string;
  author: string;
}

export interface AnniversaryEvent {
  id: string;
  title: string;
  lunarDate: string;
  solarDate: string;
  host: string;
  location: string;
  description: string;
  ritualGuide: string[];
}

export interface ClanContribution {
  id: string;
  name: string;
  generation: number;
  branch: string;
  amount: string;
  purpose: string;
  date: string;
}
