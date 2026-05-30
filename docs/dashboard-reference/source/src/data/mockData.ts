import { FamilyMember, ClanEvent, TreasuryTx, OutstandingMember } from "../types";

export const mockFamilyMembers: FamilyMember[] = [
  // Generation 1: Thủy Tổ (Progenitor)
  {
    id: "m1",
    name: "Cao Quý Công (Húy: Văn Lãm)",
    generation: 1,
    branch: "Thủy Tổ Gia Tộc",
    gender: "Nghị",
    isDeceased: true,
    birthYear: "1682",
    deathYear: "1751",
    deathAnniversaryLunar: "15 tháng 3",
    graveLocation: "Thung Lá, xã Gia Sinh, Gia Viễn, Ninh Bình",
    bio: "Khởi tổ dòng họ Cao tại Ninh Bình. Ông vốn là quan đệ tam phẩm nhà Lê trung hưng, sau lui về ẩn sơn dã Trường Yên chí sỹ, lập gia trang dưỡng thân, khai hoang lập ấp, lập đền thờ đức Thánh mẫu Thượng Ngàn.",
    achievements: ["Sắc phong Triều Lê Trung Hưng", "Khai hoang Chiêu dân lập Điện thờ"],
    children: ["m2", "m3"]
  },
  
  // Generation 2: Branches split
  {
    id: "m2",
    name: "Cao Văn Sâm",
    generation: 2,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m1",
    birthYear: "1710",
    deathYear: "1785",
    deathAnniversaryLunar: "05 tháng Giêng",
    graveLocation: "Núi Kỳ Lân, xã Trường Yên, Hoa Lư, Ninh Bình",
    bio: "Kế thừa tiên tổ, phát triển ngành Nông học Gia tôn. Ông là người uyên thâm Nho học và nổi tiếng y thuật bốc thuốc cứu người nghèo trong vùng Thiên Quan.",
    achievements: ["Nhân y nổi tiếng phủ Thiên Quan", "Chánh trưởng tộc đời thứ 2"],
    children: ["m4", "m5"]
  },
  {
    id: "m3",
    name: "Cao Văn Biền",
    generation: 2,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m1",
    birthYear: "1715",
    deathYear: "1792",
    deathAnniversaryLunar: "22 tháng Chạp",
    graveLocation: "Xã Khánh Hòa, Yên Khánh, Ninh Bình",
    bio: "Mở rộng nghiệp ruộng sang vùng ngập nương Yên Khánh. Thiết lập dinh cơ chi điền, mở hiệu sản sinh mắm muối, tương hỗ trợ bang liên phủ Trường Yên quốc đạo.",
    achievements: ["Khai sáng Chi thứ 2 phủ Yên Khánh"],
    children: ["m6"]
  },

  // Generation 3
  {
    id: "m4",
    name: "Cao Văn Đề",
    generation: 3,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m2",
    birthYear: "1745",
    deathYear: "1812",
    deathAnniversaryLunar: "12 tháng 5",
    graveLocation: "Gò Mả Dứa, Trường Yên, Hoa Lư, Ninh Bình",
    bio: "Gia thế hiển hách dưới thời Tây Sơn, giữ trọng trách Lương ngự tào thủ Phủ Thiên Trường, giúp gom lương tiền chống ngoại xâm.",
    achievements: ["Tây Sơn Triều - Quân Lương Ngự Tào"],
    children: ["m7"]
  },
  {
    id: "m5",
    name: "Cao Thị Nhàn",
    generation: 3,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nữ",
    isDeceased: true,
    parentId: "m2",
    birthYear: "1748",
    deathYear: "1825",
    deathAnniversaryLunar: "09 tháng 10",
    graveLocation: "Đồi rặng trâm Hoa Lư",
    bio: "Con gái hiền thảo, đắc lực giúp đỡ khai điền thung lũng Hoa Lư. Tương truyền bà có đóng góp mười mẫu ruộng cúng tiến Tổ Đường làm tự điền.",
    achievements: ["Hiến từ mười mẫu tự điền xây dựng từ miếu dòng họ"],
    children: []
  },
  {
    id: "m6",
    name: "Cao Văn Chước",
    generation: 3,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m3",
    birthYear: "1750",
    deathYear: "1828",
    deathAnniversaryLunar: "17 tháng Tám",
    graveLocation: "Khánh Hòa, Yên Khánh",
    bio: "Tăng cường chấn hưng thủy lợi địa phương, lập đê đập chống triều ngập dâng, gia tôn danh xưng tôn kính 'Khẩn Điền Lão Sư'.",
    achievements: ["Nhà nông lâm kỳ tài phủ Yên Khánh"],
    children: ["m8"]
  },

  // Generation 4
  {
    id: "m7",
    name: "Cao Văn Chính",
    generation: 4,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m4",
    birthYear: "1782",
    deathYear: "1860",
    deathAnniversaryLunar: "04 tháng 4",
    graveLocation: "Nghĩa trang dòng họ Trường Yên",
    bio: "Nhà túc nho mẫu mực dưới triều Nguyễn (Minh Mạng), thọ lục cấp bách niên, thong sảng thi thơ phong nhã, biên chép văn tế gia tộc sơ bản chính sử.",
    achievements: ["Biên soạn sơ bản Gia Phả cổ thư dòng họ Cao Ninh Bình (1818)"],
    children: ["m9", "m10"]
  },
  {
    id: "m8",
    name: "Cao Văn Khoa",
    generation: 4,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m6",
    birthYear: "1788",
    deathYear: "1865",
    deathAnniversaryLunar: "29 tháng Tám",
    graveLocation: "Yên Khánh, Gia Viễn",
    bio: "Thương nhân danh tiếng, đứng ra lập phường hội mộc nghệ và dệt cói, mang tiếng thơm về làng quê trù mật.",
    achievements: ["Trưởng bách nghệ Yên Khánh"],
    children: ["m11"]
  },

  // Generation 5 - Modern era ancestors
  {
    id: "m9",
    name: "Cao Xuân Tự",
    generation: 5,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m7",
    birthYear: "1830",
    deathYear: "1910",
    deathAnniversaryLunar: "18 tháng Chạp",
    graveLocation: "Từ đường dòng họ Cao, Trường Yên",
    bio: "Đỗ Tú tài hành tẩu phủ hạt Ninh Bình, sáng lập thư đường giảng giải học vấn chữ Nho cho gia đình và thanh thiếu niên trong phủ.",
    achievements: ["Triều Nguyễn Tú Tài quan sắc thực"],
    children: ["m12", "m13"]
  },
  {
    id: "m10",
    name: "Cao Xuân Quýnh",
    generation: 5,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m7",
    birthYear: "1835",
    deathYear: "1913",
    deathAnniversaryLunar: "02 tháng Hai",
    graveLocation: "Gò rùa Trường Yên",
    bio: "Dành cả cuộc đời gìn giữ phần mộ tổ tông, tôn tạo đền Từ đường. Danh sư đúc đồng có công tạo tác các linh vật Đại tự, Đỉnh hương lưu truyền.",
    achievements: ["Tạo tác Đỉnh đồng cổ tự đường dòng họ"],
    children: []
  },
  {
    id: "m11",
    name: "Cao Xuân Trí",
    generation: 5,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m8",
    birthYear: "1840",
    deathYear: "1921",
    deathAnniversaryLunar: "11 tháng Mười",
    graveLocation: "Khánh Hòa, Yên Khánh",
    bio: "Đi đầu chống sưu cao thuế nặng thời cận đại Pháp thuộc, bảo vệ nông thôn bình yên vững mạnh.",
    achievements: ["Hội trưởng Hương ước giữ làng"],
    children: ["m14"]
  },

  // Generation 6 - Late 20th Century Deceased or Alive Elder Leaders
  {
    id: "m12",
    name: "Cao Xuân Khang",
    generation: 6,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m9",
    birthYear: "1885",
    deathYear: "1968",
    deathAnniversaryLunar: "01 tháng Sáu",
    graveLocation: "Nghĩa trang liệt sĩ Hoa Lư (Quy tập mộ tổ)",
    bio: "Nhà lão thành Cách mạng, tham gia phong trào chống sưu thời Pháp thuộc, chiến sĩ Điện Biên Phủ anh hùng. Người khai sinh gia tộc vẻ vang kháng chiến.",
    achievements: ["Huân chương Kháng chiến hạng Nhất", "Bí thư Chi bộ thế hệ đầu"],
    children: ["m15", "m16"]
  },
  {
    id: "m13",
    name: "Cao Xuân Hòa (Lão Trưởng)",
    generation: 6,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m9",
    birthYear: "1936",
    bio: "Lão trưởng bối cao niên nhất hiện nay của gia tộc Cao Ninh Bình (90 tuổi). Đương nhiệm Trưởng Ban Trị sự Gia phả, giữ giữ cuốn Đại gia phả thảo bản chữ thư cổ.",
    achievements: ["Hiến tặng 5 sắc phong cổ thư cho Viện Hán Nôm Bảo tàng"],
    children: ["m17", "m18"]
  },
  {
    id: "m14",
    name: "Cao Văn Thiện",
    generation: 6,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: true,
    parentId: "m11",
    birthYear: "1899",
    deathYear: "1972",
    deathAnniversaryLunar: "15 tháng Chạp",
    graveLocation: "Đồng Mọc, Yên Khánh",
    bio: "Nhà giáo mẫu mực cả đời dạy chữ quốc ngữ kháng chiến cứu quốc, gieo mầm tri thức sáng bừng khắp lưu vực sông Vân dạo xưa.",
    achievements: ["Thầy giáo Nhân dân thời chống Pháp kỳ tài"],
    children: ["m19"]
  },

  // Generation 7 - Current Active Generation in their 50s-70s (The Administrators of this very application!)
  {
    id: "m15",
    name: "Cao Xuân Viết",
    generation: 7,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m12",
    birthYear: "1954",
    bio: "Đại tá Quân đội về hưu, Trưởng ban quản lý trùng tu Đền Tổ đường Dòng họ Cao Ninh Bình sơn trang, điều hành đại lễ tế Tổ giỗ thường niên.",
    achievements: ["Huân chương Chiến sĩ vẻ vang", "Trưởng Ban quản lý tôn tạo Tổ đường"],
    children: ["m20"]
  },
  {
    id: "m16",
    name: "Cao Xuân Nghị",
    generation: 7,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m12",
    birthYear: "1958",
    bio: "Kỹ sư Cầu đường, đương nhiệm Quản tộc trưởng Chi tộc Trường Yên, giám sát toàn bộ hoạt động xây dựng, quản lý phần mộ nghĩa trang dòng họ.",
    achievements: ["Kỹ sư cao cấp Nhà nước", "Tổng thư ký Hội Đồng Gia tộc"],
    children: []
  },
  {
    id: "m17",
    name: "Cao Xuân Tiến",
    generation: 7,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m13",
    birthYear: "1965",
    bio: "Nhà nghiên cứu văn hóa đình chùa Ninh Bình, Phó Trưởng Ban Bảo tồn Di sản dòng tôn Cao tộc, thường làm phiên dịch dịch văn bia Hán cổ Đền thờ Đại tổ.",
    achievements: ["Thạc sĩ Lịch sử văn hóa cổ truyền"],
    children: []
  },
  {
    id: "m18",
    name: "Cao Thị Vân",
    generation: 7,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nữ",
    isDeceased: false,
    parentId: "m13",
    birthYear: "1970",
    bio: "Giám đốc Công ty Xuất Nhập Khẩu Hoa Lư, đầu tàu tài trợ Quỹ khuyến học và Quỹ từ thiện của đại gia tộc, kết nối đồng bào hải ngoại.",
    achievements: ["Nhà tài trợ vàng trùng tu Từ đường họ tộc"],
    children: []
  },
  {
    id: "m19",
    name: "Cao Tiến Đạt",
    generation: 7,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m14",
    birthYear: "1960",
    bio: "Nhà giáo ưu tú, Trưởng chi họ Cao tại phủ Khánh Hòa Yên Khánh, tâm huyết thúc đẩy khuyến học, định kỳ trao thưởng học bổng dòng họ.",
    achievements: ["Bằng khen Nhà Giáo ưu tú cấp Bộ Giáo Dục"],
    children: ["m21"]
  },

  // Generation 8 - Young Adults (Successors)
  {
    id: "m20",
    name: "Cao Minh Tiến",
    generation: 8,
    branch: "Chi Trưởng (Trường Yên)",
    gender: "Nghị",
    isDeceased: false,
    parentId: "m15",
    birthYear: "1988",
    bio: "Tiến sĩ Công nghệ Thông tin, hiện sinh sống và giảng dạy tại Hà Nội. Anh chính là người trực tiếp xây dựng và bảo trì hệ thống số hóa Gia Phả thông minh này.",
    achievements: ["Tiến sĩ CNTT", "Giải vàng Sáng tạo trẻ Quốc gia"],
    children: []
  },
  {
    id: "m21",
    name: "Cao Thị Huyền Trang",
    generation: 8,
    branch: "Chi Thứ Hai (Yên Khánh)",
    gender: "Nữ",
    isDeceased: false,
    parentId: "m19",
    birthYear: "1994",
    bio: "Thạc sĩ Kinh Doanh Quốc tế, Trưởng nhóm Câu lạc bộ Thanh niên tình nguyện Cao tộc Ninh Binh, chuyên lập các tủ sách dòng họ hiếu học.",
    achievements: ["Thạc sĩ Kinh doanh quốc tế Đại học Fulbright"],
    children: []
  }
];

export const mockEvents: ClanEvent[] = [
  {
    id: "e1",
    title: "Đại Lễ Giỗ Tổ Thủy Tổ Cao Quý Công - Kỷ Niệm 275 Năm",
    lunarDate: "15 tháng 3",
    solarDate: "30/04/2026",
    location: "Từ Đường Dòng Họ Cao Ninh Bình, Thôn Trung, xã Trường Yên, Hoa Lư",
    organizer: "Ông Cao Xuân Viết (Trưởng ban Trị sự Gia tộc)",
    description: "Sự kiện cúng bái thường niên thiêng liêng nhất dòng họ. Triệu tập con cháu ba chi bốn ngành từ khắp mọi miền Nam Bắc về dâng hương khấn tổ, công bố gia phả bổ sung, báo cáo thu chi quỹ họ và phát động dâng hương.",
    estimatedCost: 35000000,
    status: "Đang chuẩn bị",
    category: "Cúng Giỗ"
  },
  {
    id: "e2",
    title: "Trao Thưởng Quỹ Khuyến Học & Vinh Danh Học Giả Trẻ Mùa Xuân",
    lunarDate: "Mùng 4 Tết âm lịch",
    solarDate: "20/02/2026",
    location: "Sân Thượng Từ Từ Đường Dòng Họ, Hoa Lư, Ninh Bình",
    organizer: "Bà Cao Thị Vân & Thầy Cao Tiến Đạt",
    description: "Tuyên dương và trao giấy khen học tập dòng họ kèm học bổng cho 45 cháu học sinh giỏi cấp Huyện, 12 cháu đạt giải học sinh giỏi Tỉnh, và các cháu thi đỗ đại học đạt điểm số xuất sắc dòng họ năm vừa qua.",
    estimatedCost: 15000000,
    status: "Đã hoàn thành",
    category: "Khuyến Học"
  },
  {
    id: "e3",
    title: "Tảo Mộ Tuyên Linh - Lễ Thanh Minh Tiên Tổ Gia Tộc",
    lunarDate: "03 tháng Ba âm lịch",
    solarDate: "10/04/2026",
    location: "Toàn bộ khu mộ phần dòng họ tại Thung Lá và núi Kỳ Lân",
    organizer: "Ông Cao Xuân Nghị (Trưởng Chi Trưởng)",
    description: "Lễ sửa sang, sơn quét các khu lăng mộ gia đình liệt sĩ dòng họ, dọp cỏ phát hoang quanh nghĩa trang lăng tẩm Thủy Tổ. Dâng sớ trình Tiên tổ cầu gia đạo bình an cát bảo.",
    estimatedCost: 8000000,
    status: "Đã hoàn thành",
    category: "Cúng Giỗ"
  },
  {
    id: "e4",
    title: "Họp Hội Đồng Trưởng Chi Bàn Trùng Tu Khuôn Viên Hữu Vu",
    lunarDate: "12 tháng Năm âm lịch",
    solarDate: "25/06/2026",
    location: "Phòng Trị sự Chi Họ Trưởng, Hoa Lư",
    organizer: "Các Trưởng chi hội bàn thảo dâng hiến đất đai",
    description: "Họp trù bị lấy ý kiến về đề án cải tạo nhà Hữu Vu làm nhà trưng bày hiện vật cổ gia bảo (sắc phong triều Lê, ngọc phả cổ thư, mộc bản). Dự trù ngân sách và tìm nhà thầu nghệ nhân đúc đồng mỹ nghệ Hoa Lư.",
    estimatedCost: 2000000,
    status: "Sắp diễn ra",
    category: "Họp Họ"
  },
  {
    id: "e5",
    title: "Hạ thủy Lắp đặt Thượng lương Điện thờ Tổ đường phía Đông Yên Khánh",
    lunarDate: "18 tháng Chạp",
    solarDate: "15/01/2026",
    location: "Chi điền Từ đường Yên Khánh, Ninh Bình",
    organizer: "Trưởng ban tự sự Chi 2 Cao Tiến Đạt",
    description: "Hoàn công cất nóc đền thờ tổ phụ chi Yên Khánh dẫu nhiều sóng gió, mời pháp sư hành đàn, hội đồng gia tộc Trường Yên đến dâng lễ hạ sơn dâng rượu kính chúc.",
    estimatedCost: 120000000,
    status: "Đã hoàn thành",
    category: "Khánh Thành"
  }
];

export const mockTransactions: TreasuryTx[] = [
  {
    id: "tx1",
    type: "Thu",
    amount: 15000000,
    date: "28/05/2026",
    donorOrReceiver: "Bà Cao Thị Vân (Chi Trường Yên)",
    branch: "Chi Trưởng (Trường Yên)",
    purpose: "Ủng hộ phát tâm trùng tu dãy Hữu vu Tổ đường cổ",
    category: "Sự nghiệp Trùng tu"
  },
  {
    id: "tx2",
    type: "Thu",
    amount: 3000000,
    date: "25/05/2026",
    donorOrReceiver: "Gia đình anh Cao Văn Thịnh",
    branch: "Chi Thứ Hai (Yên Khánh)",
    purpose: "Đóng góp quỹ hiếu thảo dâng tổ giỗ xuân năm nay",
    category: "Đóng góp thường niên"
  },
  {
    id: "tx3",
    type: "Chi",
    amount: 8500000,
    date: "22/05/2026",
    donorOrReceiver: "Đội Thợ mộc đúc bia mộc bản Trương Yên",
    branch: "Gia Trị Sự",
    purpose: "Thanh toán đặt cọc gỗ sến dát bia mộc bản ghi danh tổ đường",
    category: "Sự nghiệp Trùng tu"
  },
  {
    id: "tx4",
    type: "Thu",
    amount: 5000000,
    date: "15/05/2026",
    donorOrReceiver: "Tiến sĩ Cao Minh Tiến (Hà Nội)",
    branch: "Chi Trưởng (Trường Yên)",
    purpose: "Phát tâm quyên góp nóng tăng cường học bổng khuyến học hè",
    category: "Khuyến học"
  },
  {
    id: "tx5",
    type: "Chi",
    amount: 4200000,
    date: "10/05/2026",
    donorOrReceiver: "Nhà sách Nguyễn Văn Cừ Ninh Bình",
    branch: "Ban Khuyến học",
    purpose: "Mua sắm vở viết viết mực bồi dưỡng quà tặng khuyến học",
    category: "Khuyến học"
  },
  {
    id: "tx6",
    type: "Chi",
    amount: 6000000,
    date: "05/05/2026",
    donorOrReceiver: "Nghệ nhân mộc cúng Từ đường cổ",
    branch: "Ban Khánh tiết",
    purpose: "Chi mua sắm đỉnh hương trầm nhang đèn cúng tuần Rằm lớn",
    category: "Chi Tế lễ"
  },
  {
    id: "tx7",
    type: "Thu",
    amount: 12000000,
    date: "01/05/2026",
    donorOrReceiver: "Hội kiều bào dòng họ Cao Ninh Bình (Mỹ, Úc)",
    branch: "Hải ngoại",
    purpose: "Hội kiều bào quy về xây dựng lăng mộ Thủy tổ chiêu đức",
    category: "Sự nghiệp Trùng tu"
  },
  {
    id: "tx8",
    type: "Chi",
    amount: 3000000,
    date: "28/04/2026",
    donorOrReceiver: "Gia đình o Cao Thị Lan (Neo đơn)",
    branch: "Ban Từ thiện",
    purpose: "Thăm hỏi và trợ cấp đột xuất hỗ trợ đau ốm tuổi già",
    category: "Hỗ trợ hoàn cảnh khó khăn"
  }
];

export const mockOutstandingMembers: OutstandingMember[] = [
  {
    id: "o1",
    name: "Cao Minh Tiến",
    achievement: "Đỗ Học vị Tiến sĩ Công nghệ Thông tin danh giá loại Xuất Sắc tại Viện Hàn Lâm KH&CN Việt Nam",
    year: 2024,
    branch: "Chi Trưởng (Trường Yên)",
    prizeAwarded: "Cúp Vàng Trạng Nguyên trẻ dòng họ & 10.000.000đ"
  },
  {
    id: "o2",
    name: "Cao Thúy Quỳnh",
    achievement: "Tổng điểm 29.25 khối C00 đỗ Thủ Khoa Trường Đại Học Sư Phạm Hà Nội",
    year: 2025,
    branch: "Chi Thứ Hai (Yên Khánh)",
    prizeAwarded: "Bằng vinh khuyết hộc giả trẻ tiêu biểu & 5.000.000đ"
  },
  {
    id: "o3",
    name: "Cao Anh Tuấn",
    achievement: "Đoạt Huy Chương Vàng kỳ thi Olympic Toán Học Sinh Viên Toàn Quốc",
    year: 2025,
    branch: "Chi Trưởng (Trường Yên)",
    prizeAwarded: "Khăn xếp áo dài gấm rồng vàng & 3.000.000đ"
  },
  {
    id: "o4",
    name: "Cao Xuân Hải",
    achievement: "Vinh danh Gương mặt Doanh nhân Trẻ Khởi nghiệp Xuất sắc khu vực Đồng bằng sông Hồng",
    year: 2024,
    branch: "Chi Thứ Hai (Yên Khánh)",
    prizeAwarded: "Biểu trưng Đại đồng tâm thọ họ Cao"
  }
];

// Helper to calculate statistics
export const getStats = () => {
  const totalDescendants = mockFamilyMembers.length;
  const aliveCount = mockFamilyMembers.filter(m => !m.isDeceased).length;
  const deceasedCount = totalDescendants - aliveCount;
  
  // Treasury totals
  const totalCollected = mockTransactions
    .filter(tx => tx.type === "Thu")
    .reduce((sum, tx) => sum + tx.amount, 0);
    
  const totalSpent = mockTransactions
    .filter(tx => tx.type === "Chi")
    .reduce((sum, tx) => sum + tx.amount, 0);
    
  const balance = totalCollected - totalSpent;
  
  return {
    totalDescendants,
    aliveCount,
    deceasedCount,
    totalCollected,
    totalSpent,
    balance
  };
};
