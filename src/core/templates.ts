// ========== core/templates.js - 模板库定义 ==========

const TPL_STRUCTURE = [
  // 有机官能团
  { category: "结构", subcategory: "有机官能团", name: "酮", code: "\\chemfig{R-C(=O)-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "醛", code: "\\chemfig{R-C(=O)-H}" },
  { category: "结构", subcategory: "有机官能团", name: "羧酸", code: "\\chemfig{R-C(=O)-OH}" },
  { category: "结构", subcategory: "有机官能团", name: "酯", code: "\\chemfig{R-C(=O)-O-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "醚", code: "\\chemfig{R-O-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "醇", code: "\\chemfig{R-OH}" },
  { category: "结构", subcategory: "有机官能团", name: "酚", code: "\\chemfig{*6(-=-=-(-OH)=)}" },
  { category: "结构", subcategory: "有机官能团", name: "伯胺", code: "\\chemfig{R-NH_2}" },
  { category: "结构", subcategory: "有机官能团", name: "酰胺", code: "\\chemfig{R-C(=O)-NH_2}" },
  { category: "结构", subcategory: "有机官能团", name: "腈", code: "\\chemfig{R-C#N}" },
  { category: "结构", subcategory: "有机官能团", name: "硝基", code: "\\chemfig{R-NO_2}" },
  { category: "结构", subcategory: "有机官能团", name: "卤代烃", code: "\\chemfig{R-X}" },
  { category: "结构", subcategory: "有机官能团", name: "磺酸", code: "\\chemfig{R-SO_3H}" },
  { category: "结构", subcategory: "有机官能团", name: "硫醇", code: "\\chemfig{R-SH}" },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "酸酐",
    code: "\\chemfig{R-C(=O)-O-C(=O)-R'}",
  },
  { category: "结构", subcategory: "有机官能团", name: "酰卤", code: "\\chemfig{R-C(=O)-X}" },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "烯醇",
    code: "\\chemfig{R-C(=C(-OH)-R')-R''}",
  },
  { category: "结构", subcategory: "有机官能团", name: "肟", code: "\\chemfig{R-C(=N-OH)-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "腙", code: "\\chemfig{R-C(=N-NH_2)-R'}" },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "缩醛",
    code: "\\chemfig{R-CH(-OR')(-OR'')}",
  },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "半缩醛",
    code: "\\chemfig{R-CH(-OH)(-OR')}",
  },
  { category: "结构", subcategory: "有机官能团", name: "仲胺", code: "\\chemfig{R-NH-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "叔胺", code: "\\chemfig{R-N(-R')-R''}" },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "季铵盐",
    code: "\\chemfig{R-N^+(-R')(-R'')-R'''}",
  },
  { category: "结构", subcategory: "有机官能团", name: "重氮盐", code: "\\chemfig{R-N_2^+ X^-}" },
  { category: "结构", subcategory: "有机官能团", name: "偶氮", code: "\\chemfig{R-N=N-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "亚砜", code: "\\chemfig{R-S(=O)-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "砜", code: "\\chemfig{R-S(=O)(=O)-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "硫醚", code: "\\chemfig{R-S-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "二硫化物", code: "\\chemfig{R-S-S-R'}" },
  { category: "结构", subcategory: "有机官能团", name: "异氰酸酯", code: "\\chemfig{R-N=C=O}" },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "碳酸酯",
    code: "\\chemfig{R-O-C(=O)-O-R'}",
  },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "氨基甲酸酯",
    code: "\\chemfig{R-O-C(=O)-NH-R'}",
  },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "内酰胺",
    code: "\\chemfig{*6(-N(-H)-C(=O)-----)}",
  },
  {
    category: "结构",
    subcategory: "有机官能团",
    name: "内酯",
    code: "\\chemfig{*6(-O-C(=O)-----)}",
  },
  // 环结构
  { category: "结构", subcategory: "环结构", name: "苯环", code: "\\chemfig{*6(-=-=-=)}" },
  { category: "结构", subcategory: "环结构", name: "取代苯环", code: "\\chemfig{*6(-=-(-R)=-=)}" },
  { category: "结构", subcategory: "环结构", name: "环己烷", code: "\\chemfig{*6(------)}" },
  { category: "结构", subcategory: "环结构", name: "环己烯", code: "\\chemfig{*6(-=----)}" },
  { category: "结构", subcategory: "环结构", name: "五元环", code: "\\chemfig{*5(-=-=-)}" },
  { category: "结构", subcategory: "环结构", name: "吡啶", code: "\\chemfig{*6(-=-N=-=)}" },
  { category: "结构", subcategory: "环结构", name: "吡咯", code: "\\chemfig{*5(-=-NH-=)}" },
  { category: "结构", subcategory: "环结构", name: "呋喃", code: "\\chemfig{*5(-=-O-=)}" },
  { category: "结构", subcategory: "环结构", name: "噻吩", code: "\\chemfig{*5(-=-S-=)}" },
  { category: "结构", subcategory: "环结构", name: "嘧啶", code: "\\chemfig{*6(-N=-N=-=)}" },
  { category: "结构", subcategory: "环结构", name: "吡嗪", code: "\\chemfig{*6(-N=-=-N=)}" },
  { category: "结构", subcategory: "环结构", name: "哒嗪", code: "\\chemfig{*6(-N=N---=)}" },
  { category: "结构", subcategory: "环结构", name: "咪唑", code: "\\chemfig{*5(-N=-NH-=)}" },
  { category: "结构", subcategory: "环结构", name: "吡唑", code: "\\chemfig{*5(-N=N--=)}" },
  { category: "结构", subcategory: "环结构", name: "恶唑", code: "\\chemfig{*5(-O=-N-=)}" },
  { category: "结构", subcategory: "环结构", name: "异恶唑", code: "\\chemfig{*5(-O-N=-=)}" },
  { category: "结构", subcategory: "环结构", name: "噻唑", code: "\\chemfig{*5(-S=-N-=)}" },
  {
    category: "结构",
    subcategory: "环结构",
    name: "吲哚",
    code: "\\chemfig{*6(-=-=-*5(-NH-=)--)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "喹啉",
    code: "\\chemfig{*6(-=-=-*6(-N=---)--)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "异喹啉",
    code: "\\chemfig{*6(-=-N=*6(---=)--)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "嘌呤",
    code: "\\chemfig{*6(-N=-N=*5(-N=NH-=)-)}",
  },
  { category: "结构", subcategory: "环结构", name: "萘", code: "\\chemfig{*6(-=-=-*6(---=)--)}" },
  {
    category: "结构",
    subcategory: "环结构",
    name: "蒽",
    code: "\\chemfig{*6(-=-=-*6(-=*6(---=)--)-=)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "菲",
    code: "\\chemfig{*6(-=-=-*6(-=-*6(---=)--)-=)}",
  },
  { category: "结构", subcategory: "环结构", name: "环氧乙烷", code: "\\chemfig{*3(--O--)}" },
  { category: "结构", subcategory: "环结构", name: "氮丙啶", code: "\\chemfig{*3(--NH--)}" },
  { category: "结构", subcategory: "环结构", name: "环丙烷", code: "\\chemfig{*3(---)}" },
  { category: "结构", subcategory: "环结构", name: "环丁烷", code: "\\chemfig{*4(----)}" },
  { category: "结构", subcategory: "环结构", name: "环戊烷", code: "\\chemfig{*5(-----)}" },
  { category: "结构", subcategory: "环结构", name: "环己酮", code: "\\chemfig{*6(----C(=O)-)}" },
  { category: "结构", subcategory: "环结构", name: "环己醇", code: "\\chemfig{*6(----(-OH)-)}" },
  { category: "结构", subcategory: "环结构", name: "苯胺", code: "\\chemfig{*6(-=-=-(-NH_2)=)}" },
  { category: "结构", subcategory: "环结构", name: "苯酚", code: "\\chemfig{*6(-=-=-(-OH)=)}" },
  { category: "结构", subcategory: "环结构", name: "甲苯", code: "\\chemfig{*6(-=-=-(-CH_3)=)}" },
  { category: "结构", subcategory: "环结构", name: "氯苯", code: "\\chemfig{*6(-=-=-(-Cl)=)}" },
  { category: "结构", subcategory: "环结构", name: "硝基苯", code: "\\chemfig{*6(-=-=-(-NO_2)=)}" },
  {
    category: "结构",
    subcategory: "环结构",
    name: "苯甲酸",
    code: "\\chemfig{*6(-=-=-(-C(=O)-OH)=)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "苯甲醛",
    code: "\\chemfig{*6(-=-=-(-C(=O)-H)=)}",
  },
  {
    category: "结构",
    subcategory: "环结构",
    name: "苯乙酮",
    code: "\\chemfig{*6(-=-=-(-C(=O)-CH_3)=)}",
  },
  // 链状
  { category: "结构", subcategory: "链状", name: "链状烷烃", code: "\\chemfig{A-B-C-D}" },
  { category: "结构", subcategory: "链状", name: "烯烃", code: "\\chemfig{A=B}" },
  { category: "结构", subcategory: "链状", name: "炔烃", code: "\\chemfig{A#B}" },
  { category: "结构", subcategory: "链状", name: "共轭二烯", code: "\\chemfig{A=B-C=D}" },
  // 生物/药物分子
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "咖啡因",
    code: "\\chemfig{*6(-N(-CH_3)-C(=O)-N(-CH_3)-C(=O)-N(-CH_3)-C(=O)-)}",
  },
  { category: "结构", subcategory: "生物/药物", name: "甘氨酸", code: "\\chemfig{H_2N-CH_2-COOH}" },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "丙氨酸",
    code: "\\chemfig{H_2N-CH(-CH_3)-COOH}",
  },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "苯丙氨酸",
    code: "\\chemfig{H_2N-CH(-CH_2-*6(-=-=-=))-COOH}",
  },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "甘油",
    code: "\\chemfig{HO-CH_2-CH(OH)-CH_2-OH}",
  },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "葡萄糖",
    code: "\\chemfig{HOCH_2(CHOH)_4CHO}",
  },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "阿司匹林",
    code: "\\chemfig{*6(-=-=-(-O-C(=O)-CH_3)=(-C(=O)-OH)=)}",
  },
  { category: "结构", subcategory: "生物/药物", name: "尿素", code: "\\chemfig{H_2N-C(=O)-NH_2}" },
  { category: "结构", subcategory: "生物/药物", name: "乙腈", code: "\\chemfig{CH_3-C#N}" },
  { category: "结构", subcategory: "生物/药物", name: "硝基甲烷", code: "\\chemfig{CH_3-NO_2}" },
  {
    category: "结构",
    subcategory: "生物/药物",
    name: "联苯",
    code: "\\chemfig{*6(-=-=-=-*6(-=-=-=))}",
  },
];

const TPL_SYMBOL = [
  { category: "符号", name: "单向箭头", code: "\\arrow{->}" },
  { category: "符号", name: "可逆箭头", code: "\\arrow{<->}" },
  { category: "符号", name: "平衡箭头", code: "\\arrow{<=>}" },
  { category: "符号", name: "重排箭头", code: "\\arrow{-U->}" },
  { category: "符号", name: "箭头(上下条件)", code: "\\arrow{->[上条件][下条件]}" },
  { category: "符号", name: "无箭头对齐", code: "\\arrow{0}" },
  { category: "符号", name: "加号", code: "\\+" },
  { category: "符号", name: "减号", code: "\\-" },
];

const TPL_CONDITION = [
  // 溶剂
  { category: "条件", subcategory: "溶剂", name: "乙醇", code: "\\arrow{->[EtOH][]}" },
  { category: "条件", subcategory: "溶剂", name: "甲醇", code: "\\arrow{->[MeOH][]}" },
  { category: "条件", subcategory: "溶剂", name: "乙醚", code: "\\arrow{->[Et_2O][]}" },
  { category: "条件", subcategory: "溶剂", name: "THF", code: "\\arrow{->[THF][]}" },
  { category: "条件", subcategory: "溶剂", name: "二氯甲烷", code: "\\arrow{->[CH_2Cl_2][]}" },
  { category: "条件", subcategory: "溶剂", name: "氯仿", code: "\\arrow{->[CHCl_3][]}" },
  { category: "条件", subcategory: "溶剂", name: "苯", code: "\\arrow{->[C_6H_6][]}" },
  { category: "条件", subcategory: "溶剂", name: "甲苯", code: "\\arrow{->[Toluene][]}" },
  { category: "条件", subcategory: "溶剂", name: "DMSO", code: "\\arrow{->[DMSO][]}" },
  { category: "条件", subcategory: "溶剂", name: "DMF", code: "\\arrow{->[DMF][]}" },
  { category: "条件", subcategory: "溶剂", name: "水", code: "\\arrow{->[H_2O][]}" },
  { category: "条件", subcategory: "溶剂", name: "液氨", code: "\\arrow{->[liq. NH_3][]}" },
  { category: "条件", subcategory: "溶剂", name: "丙酮", code: "\\arrow{->[Acetone][]}" },
  { category: "条件", subcategory: "溶剂", name: "乙酸", code: "\\arrow{->[AcOH][]}" },
  // 反应条件
  { category: "条件", subcategory: "反应条件", name: "加热 Δ", code: "\\arrow{->[\\Delta][]}" },
  { category: "条件", subcategory: "反应条件", name: "光照 hν", code: "\\arrow{->[h\\nu][]}" },
  { category: "条件", subcategory: "反应条件", name: "催化剂", code: "\\arrow{->[cat.][]}" },
  { category: "条件", subcategory: "反应条件", name: "无水", code: "\\arrow{->[anhydrous][]}" },
  {
    category: "条件",
    subcategory: "反应条件",
    name: "低温 -78°C",
    code: "\\arrow{->[-78^\\circ C][]}",
  },
  { category: "条件", subcategory: "反应条件", name: "室温 r.t.", code: "\\arrow{->[r.t.][]}" },
  { category: "条件", subcategory: "反应条件", name: "回流", code: "\\arrow{->[reflux][]}" },
  { category: "条件", subcategory: "反应条件", name: "高压", code: "\\arrow{->[high P][]}" },
  // 常用试剂
  { category: "条件", subcategory: "试剂", name: "AlCl₃", code: "\\arrow{->[AlCl_3][]}" },
  { category: "条件", subcategory: "试剂", name: "NaBH₄", code: "\\arrow{->[NaBH_4][]}" },
  { category: "条件", subcategory: "试剂", name: "LiAlH₄", code: "\\arrow{->[LiAlH_4][]}" },
  { category: "条件", subcategory: "试剂", name: "KMnO₄", code: "\\arrow{->[KMnO_4][]}" },
  { category: "条件", subcategory: "试剂", name: "H₂/Pd-C", code: "\\arrow{->[H_2, Pd/C][]}" },
  { category: "条件", subcategory: "试剂", name: "NBS", code: "\\arrow{->[NBS][]}" },
  { category: "条件", subcategory: "试剂", name: "NaOH", code: "\\arrow{->[NaOH][]}" },
  { category: "条件", subcategory: "试剂", name: "HCl", code: "\\arrow{->[HCl][]}" },
  { category: "条件", subcategory: "试剂", name: "H₂SO₄", code: "\\arrow{->[H_2SO_4][]}" },
  { category: "条件", subcategory: "试剂", name: "HNO₃", code: "\\arrow{->[HNO_3][]}" },
  { category: "条件", subcategory: "试剂", name: "Br₂", code: "\\arrow{->[Br_2][]}" },
  { category: "条件", subcategory: "试剂", name: "Cl₂", code: "\\arrow{->[Cl_2][]}" },
  { category: "条件", subcategory: "试剂", name: "Fe", code: "\\arrow{->[Fe][]}" },
  { category: "条件", subcategory: "试剂", name: "Zn(Hg)/HCl", code: "\\arrow{->[Zn(Hg), HCl][]}" },
  { category: "条件", subcategory: "试剂", name: "SOCl₂", code: "\\arrow{->[SOCl_2][]}" },
  { category: "条件", subcategory: "试剂", name: "PCl₅", code: "\\arrow{->[PCl_5][]}" },
  { category: "条件", subcategory: "试剂", name: "PBr₃", code: "\\arrow{->[PBr_3][]}" },
  { category: "条件", subcategory: "试剂", name: "CrO₃", code: "\\arrow{->[CrO_3][]}" },
  { category: "条件", subcategory: "试剂", name: "PCC", code: "\\arrow{->[PCC][]}" },
  { category: "条件", subcategory: "试剂", name: "Jones试剂", code: "\\arrow{->[Jones][]}" },
  { category: "条件", subcategory: "试剂", name: "OsO₄", code: "\\arrow{->[OsO_4][]}" },
  { category: "条件", subcategory: "试剂", name: "O₃", code: "\\arrow{->[O_3][Zn/H_2O]}" },
  { category: "条件", subcategory: "试剂", name: "mCPBA", code: "\\arrow{->[mCPBA][]}" },
  {
    category: "条件",
    subcategory: "试剂",
    name: "B₂H₆",
    code: "\\arrow{->[B_2H_6][H_2O_2, OH^-]}",
  },
  { category: "条件", subcategory: "试剂", name: "LDA", code: "\\arrow{->[LDA][]}" },
  { category: "条件", subcategory: "试剂", name: "t-BuOK", code: "\\arrow{->[t-BuOK][]}" },
  { category: "条件", subcategory: "试剂", name: "NaNH₂", code: "\\arrow{->[NaNH_2][]}" },
  { category: "条件", subcategory: "试剂", name: "n-BuLi", code: "\\arrow{->[n-BuLi][]}" },
  { category: "条件", subcategory: "试剂", name: "Grignard", code: "\\arrow{->[RMgX][]}" },
  { category: "条件", subcategory: "试剂", name: "NaOEt", code: "\\arrow{->[NaOEt][]}" },
  { category: "条件", subcategory: "试剂", name: "K₂CO₃", code: "\\arrow{->[K_2CO_3][]}" },
  { category: "条件", subcategory: "试剂", name: "NaHCO₃", code: "\\arrow{->[NaHCO_3][]}" },
  { category: "条件", subcategory: "试剂", name: "NH₃", code: "\\arrow{->[NH_3][]}" },
  { category: "条件", subcategory: "试剂", name: "H₂O", code: "\\arrow{->[H_2O][]}" },
  { category: "条件", subcategory: "试剂", name: "H₃O⁺", code: "\\arrow{->[H_3O^+][]}" },
  { category: "条件", subcategory: "试剂", name: "OH⁻", code: "\\arrow{->[OH^-][]}" },
  { category: "条件", subcategory: "试剂", name: "H⁺", code: "\\arrow{->[H^+][]}" },
  { category: "条件", subcategory: "试剂", name: "Δ 加热", code: "\\arrow{->[\\Delta][]}" },
  { category: "条件", subcategory: "试剂", name: "hν 光照", code: "\\arrow{->[h\\nu][]}" },
];

// 无机化学式模板 (使用 mhchem 的 \ce{} 命令)

const TPL_INORGANIC = [
  // 常见无机物
  { category: "无机", subcategory: "氧化物", name: "水", code: "\\ce{H2O}" },
  { category: "无机", subcategory: "氧化物", name: "二氧化碳", code: "\\ce{CO2}" },
  { category: "无机", subcategory: "氧化物", name: "二氧化硫", code: "\\ce{SO2}" },
  { category: "无机", subcategory: "氧化物", name: "三氧化硫", code: "\\ce{SO3}" },
  { category: "无机", subcategory: "氧化物", name: "一氧化氮", code: "\\ce{NO}" },
  { category: "无机", subcategory: "氧化物", name: "二氧化氮", code: "\\ce{NO2}" },
  { category: "无机", subcategory: "氧化物", name: "五氧化二磷", code: "\\ce{P2O5}" },
  { category: "无机", subcategory: "氧化物", name: "过氧化氢", code: "\\ce{H2O2}" },
  // 酸
  { category: "无机", subcategory: "酸", name: "盐酸", code: "\\ce{HCl}" },
  { category: "无机", subcategory: "酸", name: "硫酸", code: "\\ce{H2SO4}" },
  { category: "无机", subcategory: "酸", name: "硝酸", code: "\\ce{HNO3}" },
  { category: "无机", subcategory: "酸", name: "磷酸", code: "\\ce{H3PO4}" },
  { category: "无机", subcategory: "酸", name: "碳酸", code: "\\ce{H2CO3}" },
  { category: "无机", subcategory: "酸", name: "氢氟酸", code: "\\ce{HF}" },
  { category: "无机", subcategory: "酸", name: "氢溴酸", code: "\\ce{HBr}" },
  { category: "无机", subcategory: "酸", name: "氢碘酸", code: "\\ce{HI}" },
  // 碱
  { category: "无机", subcategory: "碱", name: "氢氧化钠", code: "\\ce{NaOH}" },
  { category: "无机", subcategory: "碱", name: "氢氧化钾", code: "\\ce{KOH}" },
  { category: "无机", subcategory: "碱", name: "氢氧化钙", code: "\\ce{Ca(OH)2}" },
  { category: "无机", subcategory: "碱", name: "氢氧化钡", code: "\\ce{Ba(OH)2}" },
  { category: "无机", subcategory: "碱", name: "氨水", code: "\\ce{NH3.H2O}" },
  // 盐
  { category: "无机", subcategory: "盐", name: "氯化钠", code: "\\ce{NaCl}" },
  { category: "无机", subcategory: "盐", name: "碳酸钠", code: "\\ce{Na2CO3}" },
  { category: "无机", subcategory: "盐", name: "碳酸氢钠", code: "\\ce{NaHCO3}" },
  { category: "无机", subcategory: "盐", name: "硫酸铜", code: "\\ce{CuSO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸亚铁", code: "\\ce{FeSO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸铁", code: "\\ce{Fe2(SO4)3}" },
  { category: "无机", subcategory: "盐", name: "硝酸银", code: "\\ce{AgNO3}" },
  { category: "无机", subcategory: "盐", name: "氯化钡", code: "\\ce{BaCl2}" },
  { category: "无机", subcategory: "盐", name: "高锰酸钾", code: "\\ce{KMnO4}" },
  { category: "无机", subcategory: "盐", name: "重铬酸钾", code: "\\ce{K2Cr2O7}" },
  // 单质
  { category: "无机", subcategory: "单质", name: "氢气", code: "\\ce{H2}" },
  { category: "无机", subcategory: "单质", name: "氧气", code: "\\ce{O2}" },
  { category: "无机", subcategory: "单质", name: "氮气", code: "\\ce{N2}" },
  { category: "无机", subcategory: "单质", name: "氯气", code: "\\ce{Cl2}" },
  { category: "无机", subcategory: "单质", name: "溴", code: "\\ce{Br2}" },
  { category: "无机", subcategory: "单质", name: "碘", code: "\\ce{I2}" },
  // 无机反应式
  {
    category: "无机",
    subcategory: "反应式",
    name: "中和反应",
    code: "\\ce{HCl + NaOH -> NaCl + H2O}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "沉淀反应",
    code: "\\ce{AgNO3 + NaCl -> AgCl v + NaNO3}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "氧化还原",
    code: "\\ce{2KMnO4 + 16HCl -> 2KCl + 2MnCl2 + 5Cl2 ^ + 8H2O}",
  },
  { category: "无机", subcategory: "反应式", name: "可逆反应", code: "\\ce{N2 + 3H2 <=> 2NH3}" },
  { category: "无机", subcategory: "反应式", name: "电离方程式", code: "\\ce{NaCl -> Na+ + Cl-}" },
  // 更多氧化物
  { category: "无机", subcategory: "氧化物", name: "一氧化碳", code: "\\ce{CO}" },
  { category: "无机", subcategory: "氧化物", name: "三氧化二铁", code: "\\ce{Fe2O3}" },
  { category: "无机", subcategory: "氧化物", name: "四氧化三铁", code: "\\ce{Fe3O4}" },
  { category: "无机", subcategory: "氧化物", name: "氧化钙", code: "\\ce{CaO}" },
  { category: "无机", subcategory: "氧化物", name: "氧化镁", code: "\\ce{MgO}" },
  { category: "无机", subcategory: "氧化物", name: "氧化铝", code: "\\ce{Al2O3}" },
  { category: "无机", subcategory: "氧化物", name: "二氧化硅", code: "\\ce{SiO2}" },
  { category: "无机", subcategory: "氧化物", name: "氧化锌", code: "\\ce{ZnO}" },
  { category: "无机", subcategory: "氧化物", name: "氧化铜", code: "\\ce{CuO}" },
  { category: "无机", subcategory: "氧化物", name: "氧化亚铜", code: "\\ce{Cu2O}" },
  // 更多酸
  { category: "无机", subcategory: "酸", name: "亚硫酸", code: "\\ce{H2SO3}" },
  { category: "无机", subcategory: "酸", name: "亚硝酸", code: "\\ce{HNO2}" },
  { category: "无机", subcategory: "酸", name: "次氯酸", code: "\\ce{HClO}" },
  { category: "无机", subcategory: "酸", name: "高氯酸", code: "\\ce{HClO4}" },
  { category: "无机", subcategory: "酸", name: "氯酸", code: "\\ce{HClO3}" },
  { category: "无机", subcategory: "酸", name: "氢硫酸", code: "\\ce{H2S}" },
  { category: "无机", subcategory: "酸", name: "硼酸", code: "\\ce{H3BO3}" },
  { category: "无机", subcategory: "酸", name: "硅酸", code: "\\ce{H2SiO3}" },
  // 更多碱
  { category: "无机", subcategory: "碱", name: "氢氧化镁", code: "\\ce{Mg(OH)2}" },
  { category: "无机", subcategory: "碱", name: "氢氧化铝", code: "\\ce{Al(OH)3}" },
  { category: "无机", subcategory: "碱", name: "氢氧化铁", code: "\\ce{Fe(OH)3}" },
  { category: "无机", subcategory: "碱", name: "氢氧化亚铁", code: "\\ce{Fe(OH)2}" },
  { category: "无机", subcategory: "碱", name: "氢氧化铜", code: "\\ce{Cu(OH)2}" },
  { category: "无机", subcategory: "碱", name: "一水合氨", code: "\\ce{NH3.H2O}" },
  // 更多盐
  { category: "无机", subcategory: "盐", name: "氯化钾", code: "\\ce{KCl}" },
  { category: "无机", subcategory: "盐", name: "氯化钙", code: "\\ce{CaCl2}" },
  { category: "无机", subcategory: "盐", name: "氯化镁", code: "\\ce{MgCl2}" },
  { category: "无机", subcategory: "盐", name: "氯化铝", code: "\\ce{AlCl3}" },
  { category: "无机", subcategory: "盐", name: "氯化铁", code: "\\ce{FeCl3}" },
  { category: "无机", subcategory: "盐", name: "氯化亚铁", code: "\\ce{FeCl2}" },
  { category: "无机", subcategory: "盐", name: "氯化铜", code: "\\ce{CuCl2}" },
  { category: "无机", subcategory: "盐", name: "氯化铵", code: "\\ce{NH4Cl}" },
  { category: "无机", subcategory: "盐", name: "硫酸钾", code: "\\ce{K2SO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸钙", code: "\\ce{CaSO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸镁", code: "\\ce{MgSO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸铝", code: "\\ce{Al2(SO4)3}" },
  { category: "无机", subcategory: "盐", name: "硫酸锌", code: "\\ce{ZnSO4}" },
  { category: "无机", subcategory: "盐", name: "硫酸钠", code: "\\ce{Na2SO4}" },
  { category: "无机", subcategory: "盐", name: "硝酸钾", code: "\\ce{KNO3}" },
  { category: "无机", subcategory: "盐", name: "硝酸钠", code: "\\ce{NaNO3}" },
  { category: "无机", subcategory: "盐", name: "硝酸铵", code: "\\ce{NH4NO3}" },
  { category: "无机", subcategory: "盐", name: "硝酸铜", code: "\\ce{Cu(NO3)2}" },
  { category: "无机", subcategory: "盐", name: "碳酸钙", code: "\\ce{CaCO3}" },
  { category: "无机", subcategory: "盐", name: "碳酸钾", code: "\\ce{K2CO3}" },
  { category: "无机", subcategory: "盐", name: "碳酸铵", code: "\\ce{(NH4)2CO3}" },
  { category: "无机", subcategory: "盐", name: "碳酸氢铵", code: "\\ce{NH4HCO3}" },
  { category: "无机", subcategory: "盐", name: "磷酸钠", code: "\\ce{Na3PO4}" },
  { category: "无机", subcategory: "盐", name: "磷酸二氢钠", code: "\\ce{NaH2PO4}" },
  { category: "无机", subcategory: "盐", name: "磷酸氢二钠", code: "\\ce{Na2HPO4}" },
  // 更多单质
  { category: "无机", subcategory: "单质", name: "铁", code: "\\ce{Fe}" },
  { category: "无机", subcategory: "单质", name: "铜", code: "\\ce{Cu}" },
  { category: "无机", subcategory: "单质", name: "锌", code: "\\ce{Zn}" },
  { category: "无机", subcategory: "单质", name: "铝", code: "\\ce{Al}" },
  { category: "无机", subcategory: "单质", name: "钠", code: "\\ce{Na}" },
  { category: "无机", subcategory: "单质", name: "钾", code: "\\ce{K}" },
  { category: "无机", subcategory: "单质", name: "钙", code: "\\ce{Ca}" },
  { category: "无机", subcategory: "单质", name: "镁", code: "\\ce{Mg}" },
  { category: "无机", subcategory: "单质", name: "碳", code: "\\ce{C}" },
  { category: "无机", subcategory: "单质", name: "硫", code: "\\ce{S}" },
  { category: "无机", subcategory: "单质", name: "磷", code: "\\ce{P}" },
  { category: "无机", subcategory: "单质", name: "硅", code: "\\ce{Si}" },
  // 更多无机反应式
  {
    category: "无机",
    subcategory: "反应式",
    name: "金属与酸",
    code: "\\ce{Zn + 2HCl -> ZnCl2 + H2 ^}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "金属与水",
    code: "\\ce{2Na + 2H2O -> 2NaOH + H2 ^}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "燃烧反应",
    code: "\\ce{CH4 + 2O2 -> CO2 + 2H2O}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "分解反应",
    code: "\\ce{2KMnO4 -> K2MnO4 + MnO2 + O2 ^}",
  },
  { category: "无机", subcategory: "反应式", name: "化合反应", code: "\\ce{2H2 + O2 -> 2H2O}" },
  {
    category: "无机",
    subcategory: "反应式",
    name: "置换反应",
    code: "\\ce{Fe + CuSO4 -> FeSO4 + Cu}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "复分解反应",
    code: "\\ce{BaCl2 + Na2SO4 -> BaSO4 v + 2NaCl}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "水解反应",
    code: "\\ce{CH3COONa + H2O <=> CH3COOH + NaOH}",
  },
  {
    category: "无机",
    subcategory: "反应式",
    name: "络合反应",
    code: "\\ce{Ag+ + 2NH3 -> [Ag(NH3)2]+}",
  },
];

// ========== 图表模板 (pgfplots) ==========

const TPL_PLOTS = [
  // 折线图
  {
    category: "图表",
    subcategory: "折线图",
    name: "简单折线图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={x},\n  ylabel={y},\n  title={折线图},\n  grid=major,\n]\n\\addplot[color=blue,mark=square] coordinates {\n  (0,0) (1,1) (2,4) (3,9) (4,16)\n};\n\\end{axis}\n\\end{tikzpicture}",
  },
  {
    category: "图表",
    subcategory: "折线图",
    name: "多曲线对比",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={时间},\n  ylabel={浓度},\n  title={多曲线对比},\n  legend pos=north west,\n  grid=major,\n]\n\\addplot[color=red,mark=o] coordinates {(0,10) (1,8) (2,6) (3,4) (4,2)};\n\\addplot[color=blue,mark=square] coordinates {(0,2) (1,4) (2,6) (3,8) (4,10)};\n\\legend{反应物,产物}\n\\end{axis}\n\\end{tikzpicture}",
  },
  {
    category: "图表",
    subcategory: "折线图",
    name: "函数图像",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={$x$},\n  ylabel={$f(x)$},\n  title={函数图像},\n  grid=both,\n  axis lines=middle,\n]\n\\addplot[color=blue,thick,domain=-3:3,samples=100] {x^2};\n\\addplot[color=red,thick,domain=-3:3,samples=100] {x^3};\n\\legend{$x^2$,$x^3$}\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 柱状图
  {
    category: "图表",
    subcategory: "柱状图",
    name: "简单柱状图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  ybar,\n  xlabel={组别},\n  ylabel={数值},\n  title={柱状图},\n  symbolic x coords={A,B,C,D},\n  xtick=data,\n  nodes near coords,\n]\n\\addplot[fill=blue!50] coordinates {(A,10) (B,20) (C,15) (D,25)};\n\\end{axis}\n\\end{tikzpicture}",
  },
  {
    category: "图表",
    subcategory: "柱状图",
    name: "分组柱状图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  ybar,\n  xlabel={月份},\n  ylabel={销售额},\n  title={分组柱状图},\n  symbolic x coords={1月,2月,3月},\n  xtick=data,\n  legend pos=north west,\n]\n\\addplot[fill=red!50] coordinates {(1月,100) (2月,150) (3月,120)};\n\\addplot[fill=blue!50] coordinates {(1月,80) (2月,120) (3月,140)};\n\\legend{产品A,产品B}\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 饼图
  {
    category: "图表",
    subcategory: "饼图",
    name: "饼图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  title={饼图},\n  axis equal,\n  hide axis,\n]\n\\addplot[pie] {\n  30/A,\n  25/B,\n  20/C,\n  15/D,\n  10/E\n};\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 散点图
  {
    category: "图表",
    subcategory: "散点图",
    name: "散点图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={X},\n  ylabel={Y},\n  title={散点图},\n  grid=major,\n]\n\\addplot[only marks,color=red,mark=*] coordinates {\n  (1,2) (2,3) (3,5) (4,4) (5,6) (6,7) (7,8) (8,7)\n};\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 面积图
  {
    category: "图表",
    subcategory: "面积图",
    name: "面积图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={时间},\n  ylabel={值},\n  title={面积图},\n  grid=major,\n]\n\\addplot[fill=blue!30,draw=blue,thick] coordinates {\n  (0,0) (1,2) (2,3) (3,5) (4,4) (5,6)\n} \\closedcycle;\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 3D图
  {
    category: "图表",
    subcategory: "3D图",
    name: "3D曲面图",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  title={3D曲面图},\n  xlabel=$x$,\n  ylabel=$y$,\n  zlabel=$z$,\n  view={60}{30},\n]\n\\addplot3[surf,domain=-2:2,samples=20] {x^2+y^2};\n\\end{axis}\n\\end{tikzpicture}",
  },
  // 坐标轴
  {
    category: "图表",
    subcategory: "坐标轴",
    name: "自定义坐标轴",
    code: "% PACKAGES: pgfplots\n\\begin{tikzpicture}\n\\begin{axis}[\n  xlabel={$x$},\n  ylabel={$y$},\n  title={自定义坐标轴},\n  xmin=-5,xmax=5,\n  ymin=-5,ymax=5,\n  axis lines=middle,\n  grid=both,\n  minor tick num=1,\n]\n\\addplot[color=red,thick,domain=-5:5,samples=100] {sin(deg(x))};\n\\end{axis}\n\\end{tikzpicture}",
  },
];

// ========== 电路模板 (circuitikz) ==========

const TPL_CIRCUIT = [
  // 基本元件
  {
    category: "电路",
    subcategory: "基本元件",
    name: "电阻",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[R=$R$] (2,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "电容",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[C=$C$] (2,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "电感",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[L=$L$] (2,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "二极管",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[D] (2,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "LED发光二极管",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[leDo] (2,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "NPN三极管",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) node[npn](Q){};\n\\draw (Q.B) -- (-1,0) node[left]{B};\n\\draw (Q.C) -- (0,1) node[above]{C};\n\\draw (Q.E) -- (0,-1) node[below]{E};\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "基本元件",
    name: "运算放大器",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) node[op amp](opamp){};\n\\draw (opamp.+) -- (-1,-0.5) node[left]{$V_+$};\n\\draw (opamp.-) -- (-1,0.5) node[left]{$V_-$};\n\\draw (opamp.out) -- (1,0) node[right]{$V_{out}$};\n\\end{tikzpicture}",
  },
  // 电源
  {
    category: "电路",
    subcategory: "电源",
    name: "直流电压源",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[V=$V$] (0,2);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "电源",
    name: "交流电压源",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[sV=$V_{AC}$] (0,2);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "电源",
    name: "电流源",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[I=$I$] (0,2);\n\\end{tikzpicture}",
  },
  // 简单电路
  {
    category: "电路",
    subcategory: "简单电路",
    name: "RC串联电路",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[V=$V$] (0,2)\n  to[R=$R$] (3,2)\n  to[C=$C$] (3,0)\n  -- (0,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "简单电路",
    name: "RLC串联电路",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[V=$V$] (0,2)\n  to[R=$R$] (2,2)\n  to[L=$L$] (4,2)\n  to[C=$C$] (4,0)\n  -- (0,0);\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "简单电路",
    name: "分压电路",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) to[V=$V_{in}$] (0,3)\n  to[R=$R_1$] (0,1.5)\n  to[R=$R_2$] (0,0);\n\\draw (0,1.5) -- (2,1.5) node[right]{$V_{out}$};\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "简单电路",
    name: "整流桥",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,2) to[D] (2,2) to[D] (4,2);\n\\draw (0,0) to[D] (2,0) to[D] (4,0);\n\\draw (0,2) -- (0,0);\n\\draw (4,2) -- (4,0);\n\\draw (2,2) -- (2,3) node[above]{$+$};\n\\draw (2,0) -- (2,-1) node[below]{$-$};\n\\end{tikzpicture}",
  },
  // 数字电路
  {
    category: "电路",
    subcategory: "数字电路",
    name: "与门",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) node[and port](and){};\n\\draw (and.in 1) -- (-1,0.3) node[left]{A};\n\\draw (and.in 2) -- (-1,-0.3) node[left]{B};\n\\draw (and.out) -- (1,0) node[right]{Y};\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "数字电路",
    name: "或门",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) node[or port](or){};\n\\draw (or.in 1) -- (-1,0.3) node[left]{A};\n\\draw (or.in 2) -- (-1,-0.3) node[left]{B};\n\\draw (or.out) -- (1,0) node[right]{Y};\n\\end{tikzpicture}",
  },
  {
    category: "电路",
    subcategory: "数字电路",
    name: "非门",
    code: "% PACKAGES: circuitikz\n\\begin{tikzpicture}[american]\n\\draw (0,0) node[not port](not){};\n\\draw (not.in) -- (-1,0) node[left]{A};\n\\draw (not.out) -- (1,0) node[right]{Y};\n\\end{tikzpicture}",
  },
];

// ========== 完整TikZ绘图模板 (TikZJax知识库 - 完整LaTeX文档) ==========
// 适用于 tikz / miktex 模式，包含完整 document 结构和透明背景设置

const TPL_TIKZ_COMPLETE = [
  // --- 基础TikZ 2D绘图 ---
  {
    category: "完整文档",
    subcategory: "TikZ基础",
    name: "函数坐标系",
    code: "\\usepackage{tikz}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzpicture}[domain=0:4]\n\\draw[very thin,color=gray] (-0.1,-1.1) grid (3.9,3.9);\n\\draw[->] (-0.2,0) -- (4.2,0) node[right] {$x$};\n\\draw[->] (0,-1.2) -- (0,4.2) node[above] {$f(x)$};\n\\draw[color=red]    plot (\\x,\\x)             node[right] {$f(x)=x$};\n\\draw[color=blue]   plot (\\x,{sin(\\x r)})    node[right] {$f(x)=\\sin x$};\n\\draw[color=orange] plot (\\x,{0.05*exp(\\x)}) node[right] {$f(x)=\\frac{1}{20}\\mathrm e^x$};\n\\end{tikzpicture}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "TikZ基础",
    name: "几何图形",
    code: "\\usepackage{tikz}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzpicture}\n\\draw (0,0) rectangle (3,2);\n\\draw (1.5,1) circle (0.8);\n\\fill (0,0) circle (2pt) node[below]{$O$};\n\\draw[->] (0,0)--(2,1.5) node[above right]{$\\vec{F}$};\n\\end{tikzpicture}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "TikZ基础",
    name: "分段函数",
    code: "\\usepackage{tikz}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzpicture}[domain=-2:2,samples=40]\n\\draw[->](-2.2,0)--(2.2,0) node[right]{$x$};\n\\draw[->](0,-1.2)--(0,2.2) node[above]{$y$};\n\\draw[red] plot (\\x,{\\x<0 ? 1 : \\x*\\x});\n\\end{tikzpicture}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "TikZ基础",
    name: "向量坐标图",
    code: "\\usepackage{tikz}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzpicture}\n\\draw[gray!30] (-3,-3) grid (3,3);\n\\draw[->] (-3.2,0)--(3.2,0);\n\\draw[->] (0,-3.2)--(0,3.2);\n\\draw[->,blue,thick] (0,0)--(2,1) node[above]{$\\mathbf{u}$};\n\\draw[->,red,thick] (0,0)--(1,2) node[above]{$\\mathbf{v}$};\n\\end{tikzpicture}\n\\end{document}",
  },
  // --- chemfig反应机理 TYPE1-TYPE6 ---
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE1 单中性分子",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{CH_3-CH_2-OH}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE2 带电荷中间体",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{(CH_3)_2\\overset{+}{C}-CH_3}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE3 单步反应式",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\schemestart\n\\chemfig{(CH_3)_2C(OH)-C(OH)(CH_3)_2}\n\\arrow{->[H^+][]}\n\\chemfig{(CH_3)_3C-C(=O)-CH_3}\n\\schemestop\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE4 多步串联反应",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\schemestart\n\\chemfig{A-B}\n\\arrow{->[Reagent1]}\n\\chemfig{A-\\overset{+}{B}H}\n\\arrow{->[]}\n\\chemfig{A^+ -B-H}\n\\arrow{->[Base]}\n\\chemfig{C-D}\n\\schemestop\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE5 电子弯箭头",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\schemestart\n\\chemfig{@{a}O-H@{b}}\n\\arrow{->}\n\\chemfig{\\overset{-}{O} + H^+}\n\\schemestop\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "反应机理",
    name: "TYPE6 多组分并列",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\schemestart\n\\chemfig{R-OH}\n\\arrow{0}[,0]\n\\+\n\\chemfig{HCl}\n\\arrow{->}\n\\chemfig{R-Cl}\n\\arrow{0}[,0]\n\\+\n\\chemfig{H_2O}\n\\schemestop\n\\end{document}",
  },
  // --- 频哪醇重排分步样例 ---
  {
    category: "完整文档",
    subcategory: "频哪醇重排",
    name: "Step1 原料",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{(CH_3)_2C(OH)-C(OH)(CH_3)_2}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "频哪醇重排",
    name: "Step2 质子化",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{(CH_3)_2C(\\overset{+}{O}H_2)-C(OH)(CH_3)_2}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "频哪醇重排",
    name: "Step3 碳正离子",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{(CH_3)_2\\overset{+}{C}-C(OH)(CH_3)_2}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "频哪醇重排",
    name: "Step4 频哪酮产物",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\chemfig{(CH_3)_3C-C(=O)-CH_3}\n\\end{document}",
  },
  // --- chemfig高级：子分子复用 ---
  {
    category: "完整文档",
    subcategory: "chemfig高级",
    name: "definesubmol 取代基",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\definesubmol\\Me{CH_3}\n\\definesubmol\\Et{CH_3-CH_2}\n\\chemfig{!\\Me-C(-!\\Et)-!\\Me}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "chemfig高级",
    name: "重复糖单元",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\definesubmol\\sugar{*6(-O-C(-OH)-C(-OH)-C(-OH)-C(-OH)-)}\n\\chemfig{!\\sugar -!\\sugar -!\\sugar}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "chemfig高级",
    name: "带参数取代基",
    code: "\\usepackage{chemfig}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\definesubmol\\Rgroup{-[::#1]R}\n\\chemfig{C(!\\Rgroup{30})(!\\Rgroup{-60})-C}\n\\end{document}",
  },
  // --- tikz-cd 交换图 ---
  {
    category: "完整文档",
    subcategory: "tikz-cd",
    name: "简单交换正方形",
    code: '\\usepackage{tikz-cd}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzcd}\nA \\arrow[r,"f"] \\arrow[d,"g"] & B \\arrow[d,"h"] \\\\\nC \\arrow[r,"k"] & D\n\\end{tikzcd}\n\\end{document}',
  },
  {
    category: "完整文档",
    subcategory: "tikz-cd",
    name: "带反向箭头",
    code: '\\usepackage{tikz-cd}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzcd}\nX \\arrow[r, "i"] & Y \\arrow[r, "p"] \\arrow[l, bend left, "r"] & Z\n\\end{tikzcd}\n\\end{document}',
  },
  {
    category: "完整文档",
    subcategory: "tikz-cd",
    name: "长正合序列",
    code: "\\usepackage{tikz-cd}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzcd}[column sep=1.8em]\nA \\arrow[r] & B \\arrow[r] & C \\arrow[r] & D \\arrow[r] & E\n\\end{tikzcd}\n\\end{document}",
  },
  {
    category: "完整文档",
    subcategory: "tikz-cd",
    name: "复杂交换图",
    code: '\\usepackage{tikz-cd}\n\\begin{document}\n\\tikzset{background rectangle/.style={draw=none}}\n\\begin{tikzcd}\n    T     \\arrow[drr, bend left, "x"]\n          \\arrow[ddr, bend right, "y"]\n          \\arrow[dr, dotted, "{(x,y)}" description] & & \\\\\n    K & X \\times_Z Y \\arrow[r, "p"] \\arrow[d, "q"]\n      & X \\arrow[d, "f"] \\\\\n      & Y \\arrow[r, "g"]\n      & Z\n\\end{tikzcd}\n\\end{document}',
  },
];

// miktex 模式包装: 将 chemfig 代码包装为完整 LaTeX 文档

const MODES = {
  chem: {
    label: "chem (chemfig简写)",
    lang: "chem",
    desc: `【chem 模式 — 最简写法】插件自动包裹 \\schemestart...\\schemestop

逐行解析:
  第1行  % NAME: 反应名称
         └─ 必须写, 决定输出SVG文件名, 中文可用, 不能含 \\ / : * ? " < > |

  第2行起 \\chemfig{*6(-=-=-=)}
         ├─ \\chemfig{}  = 绘制结构式的命令
         ├─ *6          = 六元环 ( *5=五元环, *3=三元环 )
         ├─ ( - = - = - = ) = 环上各键, -单键 =双键, 交替排列=苯环
         └─ 取代基写法: *6(-=-(-CH_3)=-=)  括号内(-CH_3)为环上取代基

           \\arrow{->[Na, liq. NH$_3$][EtOH]}
         ├─ \\arrow{}   = 反应箭头命令
         ├─ ->          = 单向箭头 ( <-反向, <->可逆, <=>平衡, -U->重排 )
         ├─ [上条件]    = 箭头上方文字, 下标用 $_3$, 空格用 ~ 或直接写
         └─ [下条件]    = 箭头下方文字, 可留空 ->[上][]

           \\+ 或 \\-    = 反应物之间的加减号
           \\chemname{\\chemfig{...}}{名称}  = 结构式下方标注名称

完整示例 (Birch还原):
  % NAME: Birch还原
  \\chemfig{*6(-=-=-=)}
  \\arrow{->[Na, liq. NH$_3$][EtOH]}
  \\chemfig{*6(-=--=-)}`,
    templates: [
      {
        category: "框架",
        name: "简单反应式",
        code: "\\chemfig{反应物}\n\\arrow{->[上条件][下条件]}\n\\chemfig{产物}",
      },
      {
        category: "框架",
        name: "多步反应",
        code: "\\chemfig{A}\n\\arrow{->[条件1][]}\n\\chemfig{B}\n\\arrow{->[条件2][]}\n\\chemfig{C}",
      },
      {
        category: "框架",
        name: "加号分隔反应",
        code: "\\chemfig{A}\n\\+\n\\chemfig{B}\n\\arrow{->[条件][]}\n\\chemfig{C}",
      },
      { category: "框架", name: "标注名称", code: "\\chemname{\\chemfig{*6(-=-=-=)}}{苯}" },
      {
        category: "框架",
        name: "可逆反应",
        code: "\\chemfig{A}\n\\arrow{<=>[条件][]}\n\\chemfig{B}",
      },
      {
        category: "框架",
        name: "平行反应",
        code: "\\chemfig{A}\n\\arrow{->[条件1][]}\n\\chemfig{B}\n\\arrow{->[条件2][]}\n\\chemfig{C}",
      },
      {
        category: "框架",
        name: "底物+试剂",
        code: "\\chemfig{底物}\n\\+\n\\chemfig{试剂}\n\\arrow{->[催化剂][溶剂]}\n\\chemfig{产物}",
      },
      {
        category: "框架",
        name: "氧化反应",
        code: "\\chemfig{还原剂}\n\\arrow{->[氧化剂][]}\n\\chemfig{氧化产物}",
      },
      {
        category: "框架",
        name: "还原反应",
        code: "\\chemfig{氧化剂}\n\\arrow{->[还原剂][]}\n\\chemfig{还原产物}",
      },
      {
        category: "框架",
        name: "取代反应",
        code: "\\chemfig{R-X}\n\\+\n\\chemfig{Nu^-}\n\\arrow{->[][]}\n\\chemfig{R-Nu}\n\\+\n\\chemfig{X^-}",
      },
      {
        category: "框架",
        name: "加成反应",
        code: "\\chemfig{A=B}\n\\+\n\\chemfig{C-D}\n\\arrow{->[][]}\n\\chemfig{A(-C)-B(-D)}",
      },
      {
        category: "框架",
        name: "消除反应",
        code: "\\chemfig{A(-C)-B(-D)}\n\\arrow{->[碱][]}\n\\chemfig{A=B}\n\\+\n\\chemfig{C-D}",
      },
      {
        category: "框架",
        name: "重排反应",
        code: "\\chemfig{底物}\n\\arrow{-U->[条件][]}\n\\chemfig{重排产物}",
      },
      {
        category: "框架",
        name: "缩合反应",
        code: "\\chemfig{A}\n\\+\n\\chemfig{B}\n\\arrow{->[-H_2O][]}\n\\chemfig{A-B}",
      },
      {
        category: "框架",
        name: "水解反应",
        code: "\\chemfig{底物}\n\\+\n\\chemfig{H_2O}\n\\arrow{->[H^+或OH^-][]}\n\\chemfig{产物1}\n\\+\n\\chemfig{产物2}",
      },
      {
        category: "框架",
        name: "Birch还原",
        code: "\\chemfig{*6(-=-=-=)}\n\\arrow{->[Na, liq. NH_3][EtOH]}\n\\chemfig{*6(-=--=-)}",
      },
      {
        category: "框架",
        name: "Friedel-Crafts烷基化",
        code: "\\chemfig{*6(-=-=-=)}\n\\+\n\\chemfig{R-X}\n\\arrow{->[AlCl_3][]}\n\\chemfig{*6(-=-=-(-R)=)}",
      },
      {
        category: "框架",
        name: "Friedel-Crafts酰化",
        code: "\\chemfig{*6(-=-=-=)}\n\\+\n\\chemfig{R-C(=O)-X}\n\\arrow{->[AlCl_3][]}\n\\chemfig{*6(-=-=-(-C(=O)-R)=)}",
      },
      {
        category: "框架",
        name: "格氏反应",
        code: "\\chemfig{R-MgX}\n\\+\n\\chemfig{R'-C(=O)-H}\n\\arrow{->[1. Et_2O][2. H_3O^+]}\n\\chemfig{R'-CH(-OH)-R}",
      },
      {
        category: "框架",
        name: "Diels-Alder",
        code: "\\chemfig{*6(=-=-=)}\n\\+\n\\chemfig{A=B}\n\\arrow{->[\\Delta][]}\n\\chemfig{*6(-=----(-A)(-B))}",
      },
      {
        category: "框架",
        name: "酯化反应",
        code: "\\chemfig{R-C(=O)-OH}\n\\+\n\\chemfig{R'-OH}\n\\arrow{<=>[H_2SO_4][\\Delta]}\n\\chemfig{R-C(=O)-O-R'}\n\\+\n\\chemfig{H_2O}",
      },
      {
        category: "框架",
        name: "皂化反应",
        code: "\\chemfig{R-C(=O)-O-R'}\n\\+\n\\chemfig{NaOH}\n\\arrow{->[H_2O][\\Delta]}\n\\chemfig{R-C(=O)-O^- Na^+}\n\\+\n\\chemfig{R'-OH}",
      },
      ...TPL_STRUCTURE,
      ...TPL_SYMBOL,
      ...TPL_CONDITION,
      ...TPL_INORGANIC,
    ],
  },
  tikz: {
    label: "tikz (完整chemfig)",
    lang: "tikz",
    desc: `【tikz 模式 — 完整写法】必须手动写 \\schemestart...\\schemestop

逐区块解析:
  \\schemestart        = 反应式开始标记 (必须, 与\\schemestop配对)
  \\chemfig{...}       = 结构式 (写法同chem模式, 见上)
  \\arrow{->[上][下]}  = 反应箭头
       箭头类型: -> 单向, <- 反向, <-> 可逆, <=> 平衡, -U-> 重排箭头
       条件写法: [上方文字][下方文字], 下标 $_3$, 上标 $^+$, 撇号 \\textquotesingle
  \\+ / \\-             = 反应物之间的 + / - 号
  \\schemestop         = 反应式结束标记 (必须)

高级写法:
  \\chemfig{A-B}       = 链状结构, A-B单键, A=B双键, A#B三键
  \\chemfig{*6(------)}= 环己烷 (全单键), *6(-=-=-=)=苯环
  \\chemfig{R-C(=O)-OH}= 带分支: 括号(=O)表示C上连双键O
  \\arrow{0}           = 无箭头, 仅对齐
  \\subscheme{...}     = 嵌套子反应式

完整示例 (Friedel-Crafts烷基化):
  % NAME: FC烷基化
  \\schemestart
  \\chemfig{*6(-=-=-=)}
  \\+
  \\chemfig{CH_3-Cl}
  \\arrow{->[AlCl$_3$][\\Delta]}
  \\chemfig{*6(-=-(-CH_3)=-=)}
  \\+
  \\chemfig{HCl}
  \\schemestop`,
    templates: [
      {
        category: "框架",
        name: "完整反应框架",
        code: "\\schemestart\n\\chemfig{反应物}\n\\arrow{->[上条件][下条件]}\n\\chemfig{产物}\n\\schemestop",
      },
      {
        category: "框架",
        name: "多步反应",
        code: "\\schemestart\n\\chemfig{A}\n\\arrow{->[条件1][]}\n\\chemfig{B}\n\\arrow{->[条件2][]}\n\\chemfig{C}\n\\schemestop",
      },
      {
        category: "框架",
        name: "加号分隔反应",
        code: "\\schemestart\n\\chemfig{A}\n\\+\n\\chemfig{B}\n\\arrow{->[条件][]}\n\\chemfig{C}\n\\schemestop",
      },
      {
        category: "框架",
        name: "子图嵌套",
        code: "\\schemestart\n\\subscheme{\\chemfig{A}\\+\\chemfig{B}}\n\\arrow{->}\n\\chemfig{C}\n\\schemestop",
      },
      { category: "框架", name: "标注名称", code: "\\chemname{\\chemfig{*6(-=-=-=)}}{苯}" },
      ...TPL_STRUCTURE,
      ...TPL_SYMBOL,
      ...TPL_CONDITION,
      ...TPL_INORGANIC,
      ...TPL_PLOTS,
      ...TPL_CIRCUIT,
      ...TPL_TIKZ_COMPLETE,
    ],
  },
  miktex: {
    label: "miktex (完整LaTeX)",
    lang: "miktex",
    desc: `【miktex 模式 — 完整 LaTeX 文档】插件不补全任何内容, 直接编译

必备结构 (缺一不可):
  \\documentclass[border=4pt]{standalone}
  └─ 文档类必须用 standalone, border=边距(pt), 否则裁切不对
  \\usepackage{chemfig}   ← 导入结构式包
  \\usepackage{tikz}      ← 导入绘图包
  \\begin{document}       ← 文档开始 (必须)
  ... 你的绘图代码 ...
  \\end{document}         ← 文档结束 (必须)

注意事项:
  • pdflatex 不支持中文, 文字标注用英文或加 \\usepackage{ctex}
  • 复杂坐标绘图用 \\begin{tikzpicture}...\\end{tikzpicture}
  • 化学结构式仍用 \\chemfig{} / \\schemestart...\\schemestop
  • 可自定义宏、颜色、节点标注

完整示例 (自定义标注):
  % NAME: 苯环标注
  \\documentclass[border=8pt]{standalone}
  \\usepackage{chemfig}
  \\usepackage{tikz}
  \\begin{document}
  \\begin{tikzpicture}
  \\node at (0,0) {\\chemfig{*6(-=-=-=)}};
  \\node[red] at (1.5,0.8) {Electrophilic site};
  \\draw[->,red,thick] (1.0,0.5) -- (0.4,0.3);
  \\end{tikzpicture}
  \\end{document}`,
    templates: [
      {
        category: "框架",
        name: "完整文档框架",
        code: "\\documentclass[border=4pt]{standalone}\n\\usepackage{chemfig}\n\\usepackage{tikz}\n\\usepackage{amsmath}\n\\begin{document}\n% 你的代码\n\\end{document}",
      },
      {
        category: "框架",
        name: "chemfig反应式",
        code: "\\documentclass[border=4pt]{standalone}\n\\usepackage{chemfig}\n\\begin{document}\n\\schemestart\n\\chemfig{反应物}\n\\arrow{->[上条件][下条件]}\n\\chemfig{产物}\n\\schemestop\n\\end{document}",
      },
      {
        category: "框架",
        name: "tikz自定义标注",
        code: "\\documentclass[border=8pt]{standalone}\n\\usepackage{chemfig}\n\\usepackage{tikz}\n\\begin{document}\n\\begin{tikzpicture}\n\\node at (0,0) {\\chemfig{*6(-=-=-=)}};\n\\node[red] at (1.5,0.8) {标注文字};\n\\draw[->,red,thick] (1.0,0.5) -- (0.4,0.3);\n\\end{tikzpicture}\n\\end{document}",
      },
      {
        category: "框架",
        name: "多反应式排列",
        code: "\\documentclass[border=4pt]{standalone}\n\\usepackage{chemfig}\n\\begin{document}\n\\schemestart\n\\chemfig{A}\n\\arrow{->}\n\\chemfig{B}\n\\schemestop\n\\vspace{5pt}\n\\schemestart\n\\chemfig{C}\n\\arrow{->}\n\\chemfig{D}\n\\schemestop\n\\end{document}",
      },
      ...TPL_STRUCTURE.map((t) => ({
        category: t.category,
        name: t.name,
        code: wrapMiktex(t.code),
      })),
      ...TPL_SYMBOL.map((t) => ({ category: t.category, name: t.name, code: wrapMiktex(t.code) })),
      ...TPL_CONDITION.map((t) => ({
        category: t.category,
        name: t.name,
        code: wrapMiktex(t.code),
      })),
      ...TPL_INORGANIC.map((t) => ({
        category: t.category,
        name: t.name,
        code: wrapMiktex(t.code),
      })),
      ...TPL_PLOTS.map((t) => ({ category: t.category, name: t.name, code: wrapMiktex(t.code) })),
      ...TPL_CIRCUIT.map((t) => ({ category: t.category, name: t.name, code: wrapMiktex(t.code) })),
      ...TPL_TIKZ_COMPLETE,
    ],
  },
  ce: {
    label: "ce (mhchem反应式)",
    lang: "ce",
    desc: `【ce 模式 — mhchem 化学反应式】用于渲染无机化学反应式、离子方程式、反应机理标注

逐行解析:
  第1行  % NAME: 反应名称
         └─ 必须写, 决定输出SVG文件名

  第2行起 \\ce{R-O^- + R'-X ->[S_N2] R-O-R' + X^-}
         ├─ \\ce{}        = mhchem 化学反应式命令
         ├ ->            = 反应箭头 ( <-反向, <=>平衡, <->可逆, -U->重排 )
         ├─ [上条件]      = 箭头上方标注, 如 [S_N2] [\\Delta] [h\\nu]
         ├─ ^- / ^+       = 上标电荷, 如 O^- (氧负离子), X^- (卤离子)
         ├─ _2 / _3       = 下标, 如 H_2O, NH_3
         ├─ +             = 反应物/产物之间的加号
         └─ 空格          = 分隔各组分, 多个空格自动合并

常用写法:
  氧化还原: \\ce{2H_2 + O_2 -> 2H_2O}
  离子反应: \\ce{Ag^+ + Cl^- -> AgCl v}
  催化反应: \\ce{N_2 + 3H_2 <=>[Fe][高温高压] 2NH_3}
  反应机理: \\ce{R-O^- + R'-X ->[S_N2] R-O-R' + X^-}
  沉淀气体: \\ce{CaCO_3 ->[\\Delta] CaO + CO_2 ^}

注意:
  • ce 模式不需要 \\schemestart, 直接写 \\ce{} 即可
  • 多个反应式可换行写多个 \\ce{}
  • 下标数字直接写 _2, 不需要 $_2$
  • 上标电荷写 ^- 或 ^+, 不需要 $^-$

🔄 模式切换:
  • 点击顶部模式按钮 (chem/tikz/miktex/ce) 可切换编辑器模式
  • 切换后代码自动转换为对应模式格式
  • ce → chem: 保留 \\ce{} 命令, 无需 schemestart
  • ce → tikz: 自动添加 \\schemestart 包裹
  • ce → miktex: 自动包装为完整 LaTeX 文档
  • chem/tikz/miktex → ce: 保留原代码, 需手动改写为 \\ce{} 格式`,
    templates: [
      { category: "框架", name: "简单反应式", code: "\\ce{A + B -> C + D}" },
      { category: "框架", name: "可逆反应", code: "\\ce{A + B <=> C + D}" },
      { category: "框架", name: "催化反应", code: "\\ce{A ->[催化剂][条件] B}" },
      { category: "框架", name: "多步反应", code: "\\ce{A ->[条件1] B ->[条件2] C}" },
      { category: "框架", name: "离子方程式", code: "\\ce{Ag^+ + Cl^- -> AgCl v}" },
      { category: "框架", name: "氧化还原", code: "\\ce{2H_2 + O_2 -> 2H_2O}" },
      { category: "框架", name: "沉淀反应", code: "\\ce{Ba^{2+} + SO_4^{2-} -> BaSO_4 v}" },
      {
        category: "框架",
        name: "气体生成",
        code: "\\ce{CaCO_3 + 2H^+ -> Ca^{2+} + H_2O + CO_2 ^}",
      },
      { category: "框架", name: "反应机理标注", code: "\\ce{R-O^- + R'-X ->[S_N2] R-O-R' + X^-}" },
      { category: "框架", name: "酸碱中和", code: "\\ce{H^+ + OH^- -> H_2O}" },
      { category: "框架", name: "水解反应", code: "\\ce{CH_3COO^- + H_2O <=> CH_3COOH + OH^-}" },
      { category: "框架", name: "电极反应", code: "\\ce{Zn -> Zn^{2+} + 2e^-}" },
      ...TPL_INORGANIC.filter((t) => /\\ce/.test(t.code)).map((t) => ({
        category: t.category,
        name: t.name,
        code: t.code,
      })),
    ],
  },
  molecule: {
    label: "molecule (可视化分子编辑器)",
    lang: "molecule",
    desc: `【molecule 模式 — 可视化分子编辑器】拖拽式绘制化学结构式，自动生成 chemfig 代码

功能特点:
  🎨 可视化画布: 左侧片段库拖拽到中间画布绘制结构
  🧪 片段库: 预置常见官能团、环系、药物分子片段
  🔧 工具面板: 右侧调整键长、键角、取代基、电荷等
  ↩️ 历史栈: 支持撤销/重做/清空操作
  📋 自动生成: 编辑完成自动生成 chemfig 代码

使用方法:
  1. 点击代码块右侧的"编辑"按钮打开分子编辑器
  2. 从左侧片段库拖拽结构到画布
  3. 使用右侧工具调整结构细节
  4. 点击"保存"按钮自动生成 chemfig 代码

支持的操作:
  • 单击片段插入到画布
  • 拖拽调整分子位置
  • 滚轮缩放画布
  • 右键删除选中元素
  • 快捷键: Ctrl+Z 撤销, Ctrl+Y 重做

🔄 模式切换:
  • molecule → chem: 自动生成 chemfig 代码
  • molecule → smiles: 自动生成 SMILES 字符串
  • chem → molecule: 解析 chemfig 代码到画布`,
    templates: [
      { category: "苯环", name: "苯", code: "\\chemfig{*6(-=-=-=)}" },
      { category: "苯环", name: "甲苯", code: "\\chemfig{*6(-=-(-CH_3)=-=)}" },
      { category: "苯环", name: "苯酚", code: "\\chemfig{*6(-=-(-OH)=-=)}" },
      { category: "苯环", name: "苯胺", code: "\\chemfig{*6(-=-(-NH_2)=-=)}" },
      { category: "脂肪链", name: "甲烷", code: "\\chemfig{CH_4}" },
      { category: "脂肪链", name: "乙烷", code: "\\chemfig{CH_3-CH_3}" },
      { category: "脂肪链", name: "乙烯", code: "\\chemfig{CH_2=CH_2}" },
      { category: "脂肪链", name: "乙炔", code: "\\chemfig{CH#CH}" },
      { category: "官能团", name: "乙醇", code: "\\chemfig{CH_3-CH_2-OH}" },
      { category: "官能团", name: "乙醛", code: "\\chemfig{CH_3-CHO}" },
      { category: "官能团", name: "乙酸", code: "\\chemfig{CH_3-COOH}" },
      { category: "官能团", name: "乙醚", code: "\\chemfig{CH_3-CH_2-O-CH_2-CH_3}" },
      { category: "杂环", name: "呋喃", code: "\\chemfig{*5(-=-O-=-)}" },
      { category: "杂环", name: "吡啶", code: "\\chemfig{*6(-=-N=-=-)}" },
      { category: "杂环", name: "吡咯", code: "\\chemfig{*5(-=-NH-=-)}" },
      { category: "药物", name: "阿司匹林", code: "\\chemfig{*6(-=-(-O-CO-CH_3)=-(-COOH)-)}" },
      { category: "药物", name: "对乙酰氨基酚", code: "\\chemfig{*6(-=-(-OH)=-(-NH-CO-CH_3)-)}" },
      { category: "药物", name: "布洛芬", code: "\\chemfig{*6(-=-(-CH(CH_3)-CH_2-CH(CH_3)_2)=-(-COOH)-)}" },
    ],
  },
};
