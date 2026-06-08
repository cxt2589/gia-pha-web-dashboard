/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AncestorNode, LineageNews, AnniversaryEvent, ClanContribution } from '../types';

export const COMPONENT_IMAGES = {
  inkLandscape: '/images/vietnamese_ink_landscape_1779856029849.png?v=20260529b',
  templeRoof: '/images/ancient_temple_roof_1779856049722.png?v=20260529b',
};

// Fallback tree used only when no persisted tree exists.
// Keep it aligned with the imported Excel/tree JSON so resets do not reintroduce old sample data.
export const ANCESTRAL_TREE: AncestorNode = {
  id: '3',
  name: 'Cao Đình Thuật (高 廷 術)',
  generation: 0,
  title: 'Cao Cao Mãnh Đế Đại Tướng Quân (高 高 猛 帝 大 將 軍)',
  birthYear: '1716',
  solarBirthDate: '01/01/1716',
  motherName: 'Không rõ',
  spouse: 'Không rõ',
  spouseList: ['Không rõ'],
  lunarAnniversary: '15/3 Canh Ngọ',
  isLiving: false,
  description: 'Cao Tổ theo dữ liệu cây phả hiện tại. Những trường còn khuyết cần đối chiếu lại từ phả ký và file Excel.',
  children: [
    {
      id: '2',
      name: 'Cao Đình Lạng (高 廷 兩)',
      generation: 1,
      parentId: '3',
      title: 'Thủy Tổ (始祖)',
      birthYear: '1716',
      solarBirthDate: '01/01/1716',
      motherName: 'Không rõ',
      spouse: 'Không rõ',
      spouseList: ['Không rõ'],
      lunarAnniversary: '10/3',
      isLiving: false,
      description: 'Thủy Tổ theo dữ liệu cây phả hiện tại. Không gán thêm tước vị Quản phận môn cho các đời khác.',
      children: [
        {
          id: '4',
          name: 'Cao Duy Đồng (高 維 同)',
          generation: 2,
          parentId: '2',
          title: '',
          motherName: 'Không rõ',
          isLiving: false,
          children: []
        },
        {
          id: '5',
          name: 'Cao Duy Mỹ (高 維 美)',
          generation: 2,
          parentId: '2',
          title: 'Trưởng tộc đời thứ 2',
          motherName: 'Không rõ',
          isLiving: false,
          children: []
        },
        {
          id: '6',
          name: 'Cao Thị Khuê (高 氏 珪)',
          generation: 2,
          parentId: '2',
          title: '',
          motherName: 'Không rõ',
          isLiving: false,
          children: []
        }
      ]
    }
  ]
};

// Phả ký (Detailed narratives)
export const PHA_KY_SECTIONS = [
  {
    id: 'nguon-goc',
    title: 'Nguồn gốc & Khởi tổ',
    sub: 'Quy chiếu từ cây phả hiện tại',
    dropCap: 'N',
    text: 'Nguồn gốc phả hệ đang được quy chiếu theo cây phả hiện tại. Cao Tổ là cụ Cao Đình Thuật (高 廷 術), tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân; Thủy Tổ là Cao Đình Lạng (高 廷 兩). Những dữ liệu còn khuyết cần được đối chiếu từ phả ký, file Excel và tư liệu gia đình.',
    extraText: 'Các nội dung giới thiệu, văn sớ và bài viết trên webview phải căn cứ vào dữ liệu đã xác minh. Khi chưa đủ chứng cứ, hệ thống cần ghi rõ là thông tin cần Ban trị sự kiểm chứng, không dùng lại nội dung mẫu cũ.'
  },
  {
    id: 'di-cu',
    title: 'Hành trình di cư',
    sub: 'Từ dữ liệu thô tới phả hệ số',
    dropCap: 'C',
    text: 'ông việc số hóa bắt đầu từ việc chuẩn hóa từng trường dữ liệu: mã định danh, họ tên, đời, cha mẹ, vợ chồng, ngày sinh mất, ngày giỗ âm lịch, chi/ngành và hành trạng. Mỗi ô trong Excel cần được quy chiếu đúng với trường trên dashboard để tránh lệch phả.',
    extraText: 'Khi dữ liệu đã rõ, webview sẽ hiển thị cho người dùng. Khi dữ liệu còn khuyết, dashboard giữ vai trò kiểm chứng để admin bổ sung và duyệt trước khi công bố.'
  },
  {
    id: 'cong-trang',
    title: 'Công trạng tiền nhân',
    sub: 'Bổ sung từ tài liệu xác thực',
    dropCap: 'T',
    text: 'ất cả công trạng, chức tước, sắc phong và hành trạng tiền nhân cần dựa trên tài liệu xác thực. AI có thể hỗ trợ diễn đạt, tóm tắt và đề xuất câu chữ, nhưng không tự gán công trạng hoặc niên hiệu khi chưa có chứng cứ trong kho tri thức.',
    extraText: 'Chiêm bái bia đá, sắc phong cổ còn truyền đời lưu giữ, thế hệ trẻ họ Cao tự răn mình phải nỗ lực học tập, rèn đức luyện tài để tiếp nối bảng vàng của tổ tông, làm sáng danh dòng tộc Cao Gia lẫy lừng giữa núi sông Ninh Bình hùng vĩ.'
  }
];

// Tộc ước Cao Gia
export const TOC_UOC_ITEMS = [
  {
    id: '01',
    title: 'Đạo hiếu và Tổ tiên',
    desc: 'Con cháu họ Cao phải lấy đạo hiếu làm đầu. Việc thờ cúng tổ tiên, chăm sóc phần mộ là trách nhiệm của mọi thành viên. Ngày giỗ Tổ (10/3 Âm lịch) toàn thể con cháu phải về tề tựu đông đủ để gắn kết tình thân gia tộc khăng khít.'
  },
  {
    id: '02',
    title: 'Học vấn và Tài năng',
    desc: 'Khuyến khích con cháu thi đua học tập, mang lại vinh quang cho dòng họ. Quỹ khuyến học Cao Gia sẽ khen thưởng những cá nhân có thành tích xuất sắc trong học tập và nghiên cứu khoa học, bồi dưỡng thế hệ kế cận tài đức vẹn toàn.'
  },
  {
    id: '03',
    title: 'Tương thân tương ái',
    desc: 'Trong dòng họ phải có sự đùm bọc, giúp đỡ lẫn nhau khi gặp khó khăn, hoạn nạn. Tối kỵ việc tranh chấp, gây mất đoàn kết nội bộ. Mọi mâu thuẫn phải được Hội đồng Tộc biểu hòa giải trên tinh thần thảo kính bao dung.'
  },
  {
    id: '04',
    title: 'Gìn giữ gia phong',
    desc: 'Gia đình là nền tảng. Con cháu phải sống trung thực, tuân thủ pháp luật nước nhà, lễ phép kính trên nhường dưới. Tránh xa các tệ nạn xã hội làm hoen ố thanh danh dòng họ.'
  }
];

// Lịch giỗ chi họ
export const ANNIVERSARY_EVENTS: AnniversaryEvent[] = [
  {
    id: 'ann1',
    title: 'Đại Lễ Giỗ Thủy Tổ Cao Đình Lạng',
    lunarDate: 'Ngày 10 tháng 03 (Âm lịch)',
    solarDate: '26/04/2026',
    host: 'Ban Trị Sự Họ Cao Ninh Bình',
    location: 'Từ đường họ Cao, Ninh Bình',
    description: 'Ngày giỗ Thủy Tổ Cao Đình Lạng, đời thứ 1 theo cây phả hiện tại. Thông tin nghi lễ cần đối chiếu với phả ký và file Excel gốc trước khi phát thông báo chính thức.',
    ritualGuide: [
      '8:00 - Tế lễ cáo yết Tổ tiên và thắp hương đảnh lễ bái gia tự',
      '9:30 - Thụ ủy cáo báo gia tài và phát thưởng khuyến học gia tộc',
      '11:00 - Thụ lộc đại đoàn viên, tọa đàm liên hoan dòng tộc'
    ]
  },
  {
    id: 'ann2',
    title: 'Lễ tưởng niệm Cao Tổ Cao Đình Thuật',
    lunarDate: 'Ngày 15 tháng 03 Canh Ngọ (Âm lịch)',
    solarDate: '25/09/2026',
    host: 'Ban Phả Ký',
    location: 'Từ đường họ Cao, Ninh Bình',
    description: 'Tưởng niệm Cao Tổ Cao Đình Thuật, tước hiệu Cao Cao Mãnh Đế Đại Tướng Quân theo dữ liệu cây phả hiện tại.',
    ritualGuide: [
      '15:00 - Sửa soạn dâng hương bái vọng',
      '16:30 - Quây quần chuyện trò dặn dò gia quy cội nguồn'
    ]
  },
  {
    id: 'ann3',
    title: 'Lễ Chúc Thọ Đầu Xuân Thượng Thọ Cao Niên',
    lunarDate: 'Ngày 04 tháng Chạp / Giêng đầu xuân',
    solarDate: '20/02/2026',
    host: 'Hội đồng Lão thành họ Cao',
    location: 'Không gian sinh hoạt họ Cao Ninh Bình',
    description: 'Nghi thức dâng trà chúc thọ Đại Lão trên 70, 80 và 90 tuổi, duy trì sự kính lão đắc thọ.',
    ritualGuide: [
      '9:00 - Tặng bằng mừng thọ của Ban liên lạc họ Cao Việt Nam',
      '10:00 - Con cháu dâng trà và chụp ảnh kỷ niệm gia tộc sum vầy'
    ]
  }
];

// Tin tức dòng họ
export const LINEAGE_NEWS_DATA: LineageNews[] = [
  {
    id: 'news1',
    title: 'Chuẩn hóa phả hệ họ Cao Ninh Bình theo dữ liệu gốc',
    category: 'su_kien',
    summary: 'Hệ thống đang chuẩn hóa quy tắc đời/phả hệ: Cao Tổ là Cao Đình Thuật, Thủy Tổ là Cao Đình Lạng.',
    content: 'Ban trị sự đang rà soát dữ liệu từ cây phả, file Excel chuẩn và tài liệu phả ký để thay thế các nội dung mẫu cũ. Các thông tin chưa xác minh như ngày tháng, chi/ngành, hành trạng, nơi an táng và quan hệ mẹ/vợ sẽ được đánh dấu để admin kiểm chứng trước khi công bố.',
    imageUrl: COMPONENT_IMAGES.templeRoof,
    date: '12/05/2025',
    author: 'Cao Văn Hùng - Trưởng Ban Xây dựng'
  },
  {
    id: 'news2',
    title: 'Kêu gọi bổ sung ảnh chân dung và hành trạng gia phả',
    category: 'hoat_dong',
    summary: 'Mỗi thành viên có thể đóng góp ảnh, ngày sinh/mất, ngày giỗ âm lịch, nơi an táng và ghi chú chi/ngành để hoàn thiện dữ liệu.',
    content: 'Để dữ liệu gia phả chính xác hơn, Ban trị sự mong con cháu các chi/ngành cung cấp thêm ảnh chân dung, thông tin hành trạng, ngày sinh, ngày mất, ngày giỗ âm lịch, nơi cư trú và nơi an táng. Thông tin sẽ được đối chiếu trước khi đưa lên webview chính thức.',
    imageUrl: COMPONENT_IMAGES.inkLandscape,
    date: '20/08/2025',
    author: 'Hội Khuyến Học Cao Gia'
  },
  {
    id: 'news3',
    title: 'Quy chiếu cột Excel với trường thông tin dashboard',
    category: 'dong_gop',
    summary: 'Bảng nhập liệu trường mở rộng được dùng để xác định mỗi cột trong Excel tương ứng với trường nào trên dashboard và webview.',
    content: 'Khi dữ liệu bị lệch hoặc còn khuyết, admin có thể dùng bảng quy chiếu để biết ô trong Excel đang là thông tin gì: mã định danh, họ tên, đời, cha/mẹ, vợ/chồng, ngày sinh/mất, ngày giỗ âm lịch, chi/ngành, số điện thoại, ảnh và ghi chú hành trạng. Đây là cơ sở để nhập liệu thống nhất giữa webview và dashboard.',
    imageUrl: COMPONENT_IMAGES.inkLandscape,
    date: '02/10/2025',
    author: 'Ban dữ liệu phả hệ'
  }
];

// Danh sách con cháu đóng góp (Simulated live ledger)
export const CLAN_CONTRIBUTIONS: ClanContribution[] = [
  { id: 'c1', name: 'Thành viên họ Cao', generation: 0, branch: 'Chưa phân chi', amount: '15.000.000 VND', purpose: 'Đóng góp quỹ tu bổ và số hóa phả hệ', date: '25/05/2026' },
  { id: 'c2', name: 'Thành viên họ Cao', generation: 0, branch: 'Chưa phân chi', amount: '8.000.000 VND', purpose: 'Đóng góp quỹ khuyến học', date: '21/05/2026' },
  { id: 'c3', name: 'Thành viên họ Cao', generation: 0, branch: 'Chưa phân chi', amount: '5.000.000 VND', purpose: 'Bổ sung tư liệu phả ký và ảnh chân dung', date: '15/05/2026' },
  { id: 'c4', name: 'Thành viên họ Cao', generation: 0, branch: 'Chưa phân chi', amount: '10.000.000 VND', purpose: 'Quỹ hoạt động tế lễ giỗ Tổ 2026', date: '10/05/2026' }
];
