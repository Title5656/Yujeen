export const pages = [
  {
    path: '/',
    title: 'Dashboard',
    label: 'ภาพรวมพอร์ต',
    description: 'พื้นที่สำหรับดูมูลค่าหุ้นที่ถือและภาพรวมการลงทุน เมื่อเชื่อมข้อมูลที่ยืนยันแล้ว',
    icon: '◫',
  },
  {
    path: '/holdings',
    title: 'Holdings',
    label: 'หลักทรัพย์ที่ถือ',
    description: 'จำนวนหุ้นและต้นทุนจะคำนวณจากธุรกรรมที่ยืนยันแล้ว ฟีเจอร์นี้ยังไม่เปิดใช้งาน',
    icon: '▥',
  },
  {
    path: '/transactions',
    title: 'Transactions',
    label: 'รายการธุรกรรม',
    description: 'พื้นที่สำหรับประวัติการซื้อขายที่ตรวจสอบแล้ว ยังไม่มีรายการธุรกรรมในระบบ',
    icon: '⇄',
  },
  {
    path: '/import',
    title: 'Import',
    label: 'นำเข้าเอกสาร',
    description:
      'การนำเข้าเอกสาร Dime และการตรวจสอบก่อนยืนยันจะเพิ่มในขั้นถัดไป ยังไม่รองรับการอัปโหลด',
    icon: '↥',
  },
  {
    path: '/watchlist',
    title: 'Watchlist',
    label: 'รายการที่ติดตาม',
    description: 'พื้นที่สำหรับติดตามหลักทรัพย์ที่สนใจ พร้อมแหล่งข้อมูลและเวลาของราคาในอนาคต',
    icon: '☆',
  },
  {
    path: '/settings',
    title: 'Settings',
    label: 'ตั้งค่าการเชื่อมต่อ',
    description:
      'การเลือกผู้ให้บริการและบันทึก API Key ยังไม่เปิดใช้งาน ขณะนี้ใช้ข้อมูลจำลองเท่านั้น',
    icon: '⚙',
  },
] as const;
