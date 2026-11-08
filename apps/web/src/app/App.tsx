import { ApiHealth } from '../components/ApiHealth.js';
import { pages } from './navigation.js';
import { ImportPage } from '../features/imports/ImportPage.js';

export function App() {
  const page = pages.find((item) => item.path === window.location.pathname);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        ข้ามไปเนื้อหาหลัก
      </a>
      <aside className="sidebar">
        <a href="/" className="brand" aria-label="Yujeen หน้าหลัก">
          <img
            className="brand-logo"
            src="/yujeen-logo.png"
            alt="Yujeen"
            width="1536"
            height="1024"
          />
          <span className="brand-caption">พื้นที่การลงทุนส่วนตัว</span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav aria-label="เมนูหลัก">
          {pages.map((item) => (
            <a
              key={item.path}
              href={item.path}
              className={page?.path === item.path ? 'nav-link is-active' : 'nav-link'}
              aria-current={page?.path === item.path ? 'page' : undefined}
            >
              <span aria-hidden="true" className="nav-icon">
                {item.icon}
              </span>
              <span>{item.title}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">M0 / FOUNDATION</span>
          <p>
            เริ่มจากรากฐานที่ชัดเจน
            <br />
            ค่อยต่อยอดพอร์ตของคุณ
          </p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>
            พอร์ตส่วนตัว <span className="breadcrumb">/ {page?.title ?? 'ไม่พบหน้า'}</span>
          </span>
          <span className="mock-badge">
            {page?.path === '/import' ? 'LOCAL · ตรวจเอกสารในเครื่อง' : 'MOCK · ข้อมูลจำลอง'}
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <p className="eyebrow">PERSONAL INVESTMENT PORTFOLIO</p>
              <h1>{page?.title ?? 'ไม่พบหน้า'}</h1>
              <p className="subtitle">{page?.label ?? 'กลับไปหน้าหลักเพื่อเริ่มต้น'}</p>
            </div>
            <span className="stage-tag">
              {page?.path === '/import' ? 'M2 · Document Import' : 'Project Foundation'}
            </span>
          </div>

          {page?.path === '/import' ? (
            <ImportPage />
          ) : (
            <>
              <section className="intro-panel" aria-labelledby="intro-title">
                <div>
                  <span className="intro-kicker">พื้นที่สำหรับพอร์ตของคุณ</span>
                  <h2 id="intro-title">วางรากฐาน เพื่อเห็นภาพการลงทุนที่ชัดขึ้น</h2>
                  <p>โครงสร้างเริ่มต้นพร้อมสำหรับการพัฒนาต่อ ขณะนี้ยังไม่มีข้อมูลการลงทุนจริง</p>
                </div>
                <div className="intro-art" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </section>

              <div className="content-grid">
                <section className="panel placeholder" aria-labelledby="placeholder-title">
                  <span className="empty-icon" aria-hidden="true">
                    {page?.icon ?? '◫'}
                  </span>
                  <p className="eyebrow">พื้นที่เตรียมพร้อม</p>
                  <h2 id="placeholder-title">{page?.label ?? 'ไม่พบหน้าที่ร้องขอ'}</h2>
                  <p>{page?.description ?? 'เลือกเมนูหลักเพื่อกลับไปยังหน้าที่รองรับ'}</p>
                  <span className="quiet-tag">ยังไม่เปิดใช้งานใน M0</span>
                </section>
                <section className="panel foundation" aria-labelledby="foundation-title">
                  <p className="eyebrow">สถานะโปรเจกต์</p>
                  <h2 id="foundation-title">ก้าวแรกของ Portfolio</h2>
                  <ApiHealth />
                  <dl>
                    <div>
                      <dt>ขั้นตอนปัจจุบัน</dt>
                      <dd>M0 · วางโครงสร้าง</dd>
                    </div>
                    <div>
                      <dt>ข้อมูลที่ใช้</dt>
                      <dd>MOCK เท่านั้น</dd>
                    </div>
                    <div>
                      <dt>การเชื่อมต่อราคา</dt>
                      <dd>ยังไม่เปิดใช้งาน</dd>
                    </div>
                  </dl>
                  <p className="foundation-note">
                    การคำนวณพอร์ต นำเข้าเอกสาร และตั้งค่าผู้ให้บริการจะเพิ่มตามลำดับการพัฒนา
                  </p>
                </section>
              </div>
            </>
          )}
          <footer>
            Personal Portfolio Tracker{' '}
            <span>
              {page?.path === '/import'
                ? 'Milestone M2 · ตรวจเอกสารในเครื่อง'
                : 'Milestone M0 · สำหรับพัฒนาในเครื่อง'}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
