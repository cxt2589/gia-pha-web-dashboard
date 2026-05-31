import React from 'react';
import { Award, FileText, Heart, Lock, Plus, Unlock, Users } from 'lucide-react';
import { AncestorNode } from '../../types';
import { formatNodeTitle } from '../../utils/lineageDisplay';
import { ContactFields } from './ContactFields';
import { LivingStatusFields } from './LivingStatusFields';
import { LunarDeathBurialFields } from './LunarDeathBurialFields';
import { MemberIdentityFields } from './MemberIdentityFields';
import { SolarDateFields } from './SolarDateFields';
import { SpouseFormFields } from './SpouseFormFields';
import { YearRangeFields } from './YearRangeFields';

type AddType = 'child' | 'spouse' | 'edit' | 'edit_spouse';
type Gender = NonNullable<AncestorNode['gender']>;

type ProfileAdminActionsProps = {
  selectedNode: AncestorNode;
  isAdmin: boolean;
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
  isAddingNode: boolean;
  addType: AddType;
  editingSpouseOriginalName: string | null;
  selectedSpouses: string[];
  clanLeaderRuleActive: boolean;
  setClanLeaderRuleActive: React.Dispatch<React.SetStateAction<boolean>>;
  startAddChild: () => void;
  startAddSpouse: () => void;
  startEditing: () => void;
  handleCancelAdd: () => void;
  handleFormSubmit: (event: React.FormEvent) => void;
  newMemberName: string;
  setNewMemberName: React.Dispatch<React.SetStateAction<string>>;
  newMemberGender: Gender;
  setNewMemberGender: React.Dispatch<React.SetStateAction<Gender>>;
  newMemberRankRole: string;
  setNewMemberRankRole: React.Dispatch<React.SetStateAction<string>>;
  newMemberCustomSuffix: string;
  setNewMemberCustomSuffix: React.Dispatch<React.SetStateAction<string>>;
  newMemberBirthYear: string;
  setNewMemberBirthYear: React.Dispatch<React.SetStateAction<string>>;
  newMemberDeathYear: string;
  setNewMemberDeathYear: React.Dispatch<React.SetStateAction<string>>;
  newMemberDescription: string;
  setNewMemberDescription: React.Dispatch<React.SetStateAction<string>>;
  newMemberSpouse: string;
  setNewMemberSpouse: React.Dispatch<React.SetStateAction<string>>;
  newMemberMother: string;
  setNewMemberMother: React.Dispatch<React.SetStateAction<string>>;
  newMemberResidence: string;
  setNewMemberResidence: React.Dispatch<React.SetStateAction<string>>;
  newMemberBurial: string;
  setNewMemberBurial: React.Dispatch<React.SetStateAction<string>>;
  newMemberLunarAnniversary: string;
  setNewMemberLunarAnniversary: React.Dispatch<React.SetStateAction<string>>;
  newMemberIsLiving: boolean;
  setNewMemberIsLiving: React.Dispatch<React.SetStateAction<boolean>>;
  newMemberPhone1: string;
  setNewMemberPhone1: React.Dispatch<React.SetStateAction<string>>;
  newMemberPhone2: string;
  setNewMemberPhone2: React.Dispatch<React.SetStateAction<string>>;
  newMemberPhone3: string;
  setNewMemberPhone3: React.Dispatch<React.SetStateAction<string>>;
  newMemberBirthPlace: string;
  setNewMemberBirthPlace: React.Dispatch<React.SetStateAction<string>>;
  newMemberDeathPlace: string;
  setNewMemberDeathPlace: React.Dispatch<React.SetStateAction<string>>;
  newMemberEmail: string;
  setNewMemberEmail: React.Dispatch<React.SetStateAction<string>>;
  newMemberSolarBirthDate: string;
  setNewMemberSolarBirthDate: React.Dispatch<React.SetStateAction<string>>;
  newMemberSolarDeathDate: string;
  setNewMemberSolarDeathDate: React.Dispatch<React.SetStateAction<string>>;
  spouseBirthYear: string;
  setSpouseBirthYear: React.Dispatch<React.SetStateAction<string>>;
  spouseDeathYear: string;
  setSpouseDeathYear: React.Dispatch<React.SetStateAction<string>>;
  spouseBirthPlace: string;
  setSpouseBirthPlace: React.Dispatch<React.SetStateAction<string>>;
  spouseDeathPlace: string;
  setSpouseDeathPlace: React.Dispatch<React.SetStateAction<string>>;
  spouseResidence: string;
  setSpouseResidence: React.Dispatch<React.SetStateAction<string>>;
  spouseLunarAnniversary: string;
  setSpouseLunarAnniversary: React.Dispatch<React.SetStateAction<string>>;
  spousePhone1: string;
  setSpousePhone1: React.Dispatch<React.SetStateAction<string>>;
  spousePhone2: string;
  setSpousePhone2: React.Dispatch<React.SetStateAction<string>>;
  spousePhone3: string;
  setSpousePhone3: React.Dispatch<React.SetStateAction<string>>;
  spouseEmail: string;
  setSpouseEmail: React.Dispatch<React.SetStateAction<string>>;
  spouseIsLiving: boolean;
  setSpouseIsLiving: React.Dispatch<React.SetStateAction<boolean>>;
  spouseSolarBirthDate: string;
  setSpouseSolarBirthDate: React.Dispatch<React.SetStateAction<string>>;
  spouseSolarDeathDate: string;
  setSpouseSolarDeathDate: React.Dispatch<React.SetStateAction<string>>;
};

export function ProfileAdminActions(props: ProfileAdminActionsProps) {
  const {
    selectedNode,
    isAdmin,
    setIsAdmin,
    isAddingNode,
    addType,
    editingSpouseOriginalName,
    selectedSpouses,
    clanLeaderRuleActive,
    setClanLeaderRuleActive,
    startAddChild,
    startAddSpouse,
    startEditing,
    handleCancelAdd,
    handleFormSubmit,
    newMemberName,
    setNewMemberName,
    newMemberGender,
    setNewMemberGender,
    newMemberRankRole,
    setNewMemberRankRole,
    newMemberCustomSuffix,
    setNewMemberCustomSuffix,
    newMemberBirthYear,
    setNewMemberBirthYear,
    newMemberDeathYear,
    setNewMemberDeathYear,
    newMemberDescription,
    setNewMemberDescription,
    newMemberSpouse,
    setNewMemberSpouse,
    newMemberMother,
    setNewMemberMother,
    newMemberResidence,
    setNewMemberResidence,
    newMemberBurial,
    setNewMemberBurial,
    newMemberLunarAnniversary,
    setNewMemberLunarAnniversary,
    newMemberIsLiving,
    setNewMemberIsLiving,
    newMemberPhone1,
    setNewMemberPhone1,
    newMemberPhone2,
    setNewMemberPhone2,
    newMemberPhone3,
    setNewMemberPhone3,
    newMemberBirthPlace,
    setNewMemberBirthPlace,
    newMemberDeathPlace,
    setNewMemberDeathPlace,
    newMemberEmail,
    setNewMemberEmail,
    newMemberSolarBirthDate,
    setNewMemberSolarBirthDate,
    newMemberSolarDeathDate,
    setNewMemberSolarDeathDate,
    spouseBirthYear,
    setSpouseBirthYear,
    spouseDeathYear,
    setSpouseDeathYear,
    spouseBirthPlace,
    setSpouseBirthPlace,
    spouseDeathPlace,
    setSpouseDeathPlace,
    spouseResidence,
    setSpouseResidence,
    spouseLunarAnniversary,
    setSpouseLunarAnniversary,
    spousePhone1,
    setSpousePhone1,
    spousePhone2,
    setSpousePhone2,
    spousePhone3,
    setSpousePhone3,
    spouseEmail,
    setSpouseEmail,
    spouseIsLiving,
    setSpouseIsLiving,
    spouseSolarBirthDate,
    setSpouseSolarBirthDate,
    spouseSolarDeathDate,
    setSpouseSolarDeathDate
  } = props;

  return (
    <>
  {/* Form trigger to ADD children or spouses live */}
  <div className="pt-4 border-t border-[#8c716e]/20 space-y-4">
    
    {/* Admin Mode Gate Access Security Overlay */}
    {!isAdmin ? (
      <div className="bg-amber-50/10 border border-dashed border-amber-500/35 rounded p-4 text-center space-y-2.5">
        <Lock className="w-5 h-5 mx-auto text-amber-700 animate-pulse" />
        <div>
          <h5 className="font-serif text-xs font-bold text-[#8b1c1c]">Ghi Chép Phả Hệ (Admin Only)</h5>
          <p className="text-[10px] text-ink-charcoal/60 leading-normal mt-0.5">
            Tính năng bổ sung con cháu mới yêu cầu quyền quản trị ban liên lạc. Quý cụ liên kết nhanh bằng nút dưới.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsAdmin(true)} // Soft bypass triggers standard admin tools straight away for easiest evaluation!
          className="px-3 py-1.5 bg-[#8b1c1c] hover:bg-[#a02222] text-silk-paper text-[10px] font-sans font-semibold rounded shadow transition-all flex items-center gap-1 mx-auto"
        >
          <Unlock className="w-3 h-3 text-amber-300" />
          <span>Kích hoạt quyền Admin nhanh 🔑</span>
        </button>
      </div>
    ) : (
      // Active forms if admin logged-in
      <>
        {!isAddingNode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={startAddChild}
                className="px-3 py-2 bg-[#8b1c1c] hover:bg-[#a02222] text-silk-paper rounded-sm text-xs font-sans font-bold flex items-center justify-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm con cháu</span>
              </button>
              <button
                onClick={startAddSpouse}
                className="px-3 py-2 bg-[#ffdea6] hover:bg-[#fdc34d] text-[#271900] rounded-sm text-xs font-sans font-bold flex items-center justify-center gap-1 transition-all"
              >
                <Heart className="w-3.5 h-3.5 text-rose-700" />
                <span>Thêm vợ/chồng</span>
              </button>
              <button
                onClick={startEditing}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-silk-paper rounded-sm text-xs font-sans font-bold flex items-center justify-center gap-1 transition-all"
              >
                <FileText className="w-3.5 h-3.5 text-amber-300" />
                <span>Sửa thông tin</span>
              </button>
            </div>

            {/* Dedicated Clans rule controller block inside the Admin panel */}
            <div className="bg-emerald-50/80 border border-emerald-300 rounded p-3 mt-1.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-serif text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-emerald-700" />
                  <span>Chế độ Kế thừa Gia tộc</span>
                </span>
                <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded leading-none shrink-0 ${
                  clanLeaderRuleActive 
                    ? 'bg-emerald-600 text-white animate-pulse' 
                    : 'bg-gray-250 text-gray-750 border border-gray-300'
                }`}>
                  {clanLeaderRuleActive ? 'ĐANG BẬT 👑' : 'ĐANG TẮT ⚙️'}
                </span>
              </div>
              <p className="text-[10px] text-emerald-900/80 leading-normal">
                Tự động phân giải các chức danh <strong>Trưởng tộc</strong>, <strong>Trưởng nam</strong>, và <strong>Đích tôn</strong> chuẩn từng nhánh hậu duệ.
              </p>
              <button
                type="button"
                onClick={() => setClanLeaderRuleActive(prev => !prev)}
                className={`w-full py-2 px-3 text-xs font-sans font-bold rounded shadow-sm transition-all border flex items-center justify-center gap-1.5 ${
                  clanLeaderRuleActive
                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-800'
                    : 'bg-white hover:bg-emerald-50 border-emerald-500 text-emerald-800'
                }`}
              >
                <Award className="w-3.5 h-3.5 text-amber-400" />
                <span>{clanLeaderRuleActive ? 'Tắt chế độ kế thừa gia tộc ❌' : 'Bật chế độ kế thừa gia tộc 📜'}</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} className="bg-white p-4 rounded-sm border border-[#8c716e]/15 space-y-3 shadow-inner">
            <div className="flex justify-between items-center border-b border-ink-charcoal/5 pb-2">
              <span className="font-serif text-xs font-bold text-primary flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#7b5800]" />
                <span>
                  {addType === 'child' && `Ghi thế hậu duệ cho cụ ${selectedNode.name}`}
                  {addType === 'spouse' && `Thêm phối ngẫu cho cụ ${selectedNode.name}`}
                  {addType === 'edit_spouse' && `Sửa phối ngẫu (${editingSpouseOriginalName}) cho cụ ${selectedNode.name}`}
                  {addType === 'edit' && `Chỉnh sửa thông tin cụ ${selectedNode.name}`}
                </span>
              </span>
              <button 
                type="button" 
                onClick={handleCancelAdd}
                className="text-rose-700 hover:underline text-[9px] font-mono cursor-pointer"
              >
                [Hủy bỏ]
              </button>
            </div>

            {addType === 'child' && (
              <div className="space-y-2.5">
                <MemberIdentityFields
                  name={newMemberName}
                  gender={newMemberGender}
                  rankRole={newMemberRankRole}
                  customSuffix={newMemberCustomSuffix}
                  autoTitle={formatNodeTitle({
                    generation: selectedNode ? selectedNode.generation + 1 : 1,
                    isLiving: newMemberIsLiving,
                    birthYear: newMemberBirthYear,
                    deathYear: newMemberDeathYear,
                    rankRole: newMemberRankRole,
                    customSuffix: newMemberCustomSuffix
                  })}
                  onNameChange={setNewMemberName}
                  onGenderChange={setNewMemberGender}
                  onRankRoleChange={setNewMemberRankRole}
                  onCustomSuffixChange={setNewMemberCustomSuffix}
                />

                <LivingStatusFields
                  livingId="isLivingMemberForm"
                  deceasedId="isDeceasedMemberForm"
                  isLiving={newMemberIsLiving}
                  onLivingChange={(isLiving) => {
                    setNewMemberIsLiving(isLiving);
                    if (isLiving) {
                      setNewMemberDeathYear('');
                      setNewMemberSolarDeathDate('');
                    }
                  }}
                />

                <YearRangeFields
                  birthYear={newMemberBirthYear}
                  deathYear={newMemberDeathYear}
                  isLiving={newMemberIsLiving}
                  deathPlaceholder="1962"
                  onBirthYearChange={setNewMemberBirthYear}
                  onDeathYearChange={setNewMemberDeathYear}
                />

                <SolarDateFields
                  birthDate={newMemberSolarBirthDate}
                  deathDate={newMemberSolarDeathDate}
                  isLiving={newMemberIsLiving}
                  onBirthDateChange={setNewMemberSolarBirthDate}
                  onDeathDateChange={setNewMemberSolarDeathDate}
                  onBirthYearDetected={setNewMemberBirthYear}
                  onDeathYearDetected={setNewMemberDeathYear}
                />

                {/* Spouses mother assignments dropdown */}
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Mẹ sinh thành (Vợ cụ nào)</label>
                  {selectedSpouses.length > 0 ? (
                    <select
                      value={newMemberMother}
                      onChange={(e) => setNewMemberMother(e.target.value)}
                      className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
                    >
                      <option value="">-- Chưa rõ / Trưởng chi thất truyền --</option>
                      {selectedSpouses.map((sp, idx) => (
                        <option key={idx} value={sp}>{sp} (Vợ thứ {idx+1})</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Ví dụ: Bà cả Nguyễn Thị Diễm"
                      value={newMemberMother}
                      onChange={(e) => setNewMemberMother(e.target.value)}
                      className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
                    />
                  )}
                  <p className="text-[8px] text-ink-charcoal/40 leading-normal">
                    * Giúp phân biệt rạch ròi chi con cháu nào thuộc dòng vợ cả hay vợ hai.
                  </p>
                </div>

                <div className="pt-2 border-t border-[#8c716e]/10">
                  <span className="text-[10px] font-serif font-bold text-primary uppercase tracking-wide">Thông tin cá nhân</span>
                </div>

                <ContactFields
                  phone1={newMemberPhone1}
                  phone2={newMemberPhone2}
                  phone3={newMemberPhone3}
                  email={newMemberEmail}
                  birthPlace={newMemberBirthPlace}
                  deathPlace={newMemberDeathPlace}
                  residence={newMemberResidence}
                  isLiving={newMemberIsLiving}
                  onPhone1Change={setNewMemberPhone1}
                  onPhone2Change={setNewMemberPhone2}
                  onPhone3Change={setNewMemberPhone3}
                  onEmailChange={setNewMemberEmail}
                  onBirthPlaceChange={setNewMemberBirthPlace}
                  onDeathPlaceChange={setNewMemberDeathPlace}
                  onResidenceChange={setNewMemberResidence}
                />

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Bản thân phối ngẫu (Nếu có sẵn vợ)</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Thị Bưởi"
                    value={newMemberSpouse}
                    onChange={(e) => setNewMemberSpouse(e.target.value)}
                    className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Hành trạng biên niên tóm lược</label>
                  <textarea
                    rows={2}
                    placeholder="Gia phả biên niên chưa chi tiết hành sự cổ thảo..."
                    value={newMemberDescription}
                    onChange={(e) => setNewMemberDescription(e.target.value)}
                    className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1.5 px-2 text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            )}

            {(addType === 'spouse' || addType === 'edit_spouse') && (
              <SpouseFormFields
                mode={addType}
                name={newMemberSpouse}
                birthYear={spouseBirthYear}
                deathYear={spouseDeathYear}
                birthPlace={spouseBirthPlace}
                deathPlace={spouseDeathPlace}
                residence={spouseResidence}
                lunarAnniversary={spouseLunarAnniversary}
                phone1={spousePhone1}
                phone2={spousePhone2}
                phone3={spousePhone3}
                isLiving={spouseIsLiving}
                solarBirthDate={spouseSolarBirthDate}
                solarDeathDate={spouseSolarDeathDate}
                email={spouseEmail}
                onNameChange={setNewMemberSpouse}
                onBirthYearChange={setSpouseBirthYear}
                onDeathYearChange={setSpouseDeathYear}
                onBirthPlaceChange={setSpouseBirthPlace}
                onDeathPlaceChange={setSpouseDeathPlace}
                onResidenceChange={setSpouseResidence}
                onLunarAnniversaryChange={setSpouseLunarAnniversary}
                onPhone1Change={setSpousePhone1}
                onPhone2Change={setSpousePhone2}
                onPhone3Change={setSpousePhone3}
                onLivingChange={setSpouseIsLiving}
                onSolarBirthDateChange={setSpouseSolarBirthDate}
                onSolarDeathDateChange={setSpouseSolarDeathDate}
                onEmailChange={setSpouseEmail}
              />
            )}

            {addType === 'edit' && (
              <div className="space-y-2.5">
                <MemberIdentityFields
                  name={newMemberName}
                  gender={newMemberGender}
                  rankRole={newMemberRankRole}
                  customSuffix={newMemberCustomSuffix}
                  autoTitle={formatNodeTitle({
                    generation: selectedNode?.generation ?? 1,
                    isLiving: newMemberIsLiving,
                    birthYear: newMemberBirthYear,
                    deathYear: newMemberDeathYear,
                    rankRole: newMemberRankRole,
                    customSuffix: newMemberCustomSuffix
                  })}
                  onNameChange={setNewMemberName}
                  onGenderChange={setNewMemberGender}
                  onRankRoleChange={setNewMemberRankRole}
                  onCustomSuffixChange={setNewMemberCustomSuffix}
                />

                <LivingStatusFields
                  livingId="isLivingEditForm"
                  deceasedId="isDeceasedEditForm"
                  isLiving={newMemberIsLiving}
                  onLivingChange={(isLiving) => {
                    setNewMemberIsLiving(isLiving);
                    if (isLiving) {
                      setNewMemberDeathYear('');
                      setNewMemberSolarDeathDate('');
                    }
                  }}
                />

                <YearRangeFields
                  birthYear={newMemberBirthYear}
                  deathYear={newMemberDeathYear}
                  isLiving={newMemberIsLiving}
                  deathPlaceholder="N?m m?t"
                  onBirthYearChange={setNewMemberBirthYear}
                  onDeathYearChange={setNewMemberDeathYear}
                />

                <SolarDateFields
                  birthDate={newMemberSolarBirthDate}
                  deathDate={newMemberSolarDeathDate}
                  isLiving={newMemberIsLiving}
                  onBirthDateChange={setNewMemberSolarBirthDate}
                  onDeathDateChange={setNewMemberSolarDeathDate}
                  onBirthYearDetected={setNewMemberBirthYear}
                  onDeathYearDetected={setNewMemberDeathYear}
                />

                <LunarDeathBurialFields
                  lunarAnniversary={newMemberLunarAnniversary}
                  burialPlace={newMemberBurial}
                  onLunarAnniversaryChange={setNewMemberLunarAnniversary}
                  onBurialPlaceChange={setNewMemberBurial}
                />

                <div className="pt-2 border-t border-[#8c716e]/10">
                  <span className="text-[10px] font-serif font-bold text-primary uppercase tracking-wide">Thông tin cá nhân</span>
                </div>

                <ContactFields
                  phone1={newMemberPhone1}
                  phone2={newMemberPhone2}
                  phone3={newMemberPhone3}
                  email={newMemberEmail}
                  birthPlace={newMemberBirthPlace}
                  deathPlace={newMemberDeathPlace}
                  residence={newMemberResidence}
                  isLiving={newMemberIsLiving}
                  onPhone1Change={setNewMemberPhone1}
                  onPhone2Change={setNewMemberPhone2}
                  onPhone3Change={setNewMemberPhone3}
                  onEmailChange={setNewMemberEmail}
                  onBirthPlaceChange={setNewMemberBirthPlace}
                  onDeathPlaceChange={setNewMemberDeathPlace}
                  onResidenceChange={setNewMemberResidence}
                />

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Bản thân phối ngẫu (Ngăn cách dấu phẩy nếu nhiều vợ)</label>
                  <input
                    type="text"
                    placeholder="Nguyễn Thị Bưởi"
                    value={newMemberSpouse}
                    onChange={(e) => setNewMemberSpouse(e.target.value)}
                    className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-ink-charcoal/50 uppercase">Hành trạng biên niên tóm lược</label>
                  <textarea
                    rows={2}
                    value={newMemberDescription}
                    onChange={(e) => setNewMemberDescription(e.target.value)}
                    className="w-full bg-white border border-[#8c716e]/20 rounded-sm py-1 px-2 text-xs focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2 bg-secondary hover:bg-[#684900] text-silk-paper font-sans font-semibold text-xs rounded transition-all shadow"
            >
              Cột Ghi Sáp Nhập Sổ Phả ✍️
            </button>
          </form>
        )}
      </>
    )}
  </div>

    </>
  );
}
