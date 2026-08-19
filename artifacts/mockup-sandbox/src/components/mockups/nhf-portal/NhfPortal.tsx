import { useState, type ReactNode } from "react";
import "./_group.css";

const blue = "#2161df";

function StatusBar() {
  return (
    <div className="status-bar">
      <span>7:20</span>
      <span className="status-icons">
        <span>●</span>
        <span>⋯</span>
        <span className="muted-bell">♧</span>
        <span className="signal">▮▮▮</span>
        <span>◔</span>
        <span className="battery">23</span>
      </span>
    </div>
  );
}

function BrowserBar() {
  return (
    <>
      <div className="browser-bar">
        <button aria-label="Back" className="browser-arrow">‹</button>
        <button aria-label="Forward" className="browser-arrow forward">›</button>
        <div className="address">
          <span className="tab-count">1</span>
          <span>te.fmbn.gov.ng</span>
          <span className="reload">◔</span>
        </div>
        <div className="browser-image">
          <span>🌴</span>
        </div>
        <button aria-label="Menu" className="menu">☰</button>
      </div>
      <div className="android-nav">
        <span className="square" />
        <span className="circle" />
        <span className="triangle" />
      </div>
    </>
  );
}

function Header() {
  return (
    <header className="portal-header">
      <div className="nhf-logo">NHF</div>
      <div>
        <div className="portal-title">NHF Data Regularization App</div>
        <div className="portal-subtitle">Step 1 of 3 — Identify yourself</div>
      </div>
    </header>
  );
}

function FooterLinks() {
  return (
    <footer className="footer">
      <p>Your data is handled in line with NDPR/GDPR.</p>
      <a href="#status">Check status / retrieve NHF number</a>
      <a href="#problem">Having trouble? Report a problem</a>
    </footer>
  );
}

function HowItWorks() {
  return (
    <section className="how-card" id="how">
      <h2><span className="info-icon">i</span> How this works</h2>
      <Step number="1" title="Enter your Staff ID/IPPIS No">
        Use the Staff ID/IPPIS No your organisation gave you. We check it against the
        staff roll. If we cannot find it, check it carefully and try again — and if it
        still will not work, use Report a problem.
      </Step>
      <Step number="2" title="We look for your existing record">
        If we already hold NHF details for you, we go to step 3. If we do not, we skip
        to step 5 and you enter your details fresh.
      </Step>
      <Step number="3" title="We ask you one security question">
        We ask for one detail only you should know — usually your BVN. Haven&apos;t got
        that particular one with you? Choose another from those offered. Answer correctly
        and we show you your record.
        <div className="note-box">Why? A Staff ID/IPPIS No is not a secret, and they run in sequence.
          Without this question, anyone who guessed a colleague&apos;s Staff ID/IPPIS No could see
          that colleague&apos;s BVN, NIN, bank account and salary.</div>
      </Step>
      <Step number="4" title="If we cannot find an existing record">
        You can still take part. We will ask you to enter your details from scratch.
        Have your BVN, NIN, bank account and contact details ready.
      </Step>
      <Step number="5" title="Check or enter your details">
        Your name comes from the staff roll and is filled in for you. Everything else is
        yours to check: your details, identity numbers, bank, address, employment and next
        of kin. Each box checks itself as you go, so a NIN that is not 11 digits tells you
        straight away.
        <div className="note-box">If the record we show you is not yours at all, tick
          &quot;This is not my data&quot; and we will start you on a blank form.</div>
      </Step>
      <Step number="6" title="Submit">
        FMBN reviews every submission before any record is changed. You can only submit
        once, so please check your details before sending.
      </Step>
      <Step number="7" title="Get your NHF number">
        After you submit, use &quot;Check status / retrieve NHF number&quot; with your Staff ID
        and the phone number you gave. If you were updating an existing record, your NHF
        number is shown straight away — keep it and quote it in any NHF or FMBN transaction.
        If you registered, your submission is reviewed first, so please check back later.
      </Step>
      <div className="problem-row">
        <span className="question-mark">?</span>
        <div><h3>If anything goes wrong</h3><p>Use <a href="#problem">Report a problem</a> at any point.
          Tell us your Staff ID/IPPIS No and what happened, and you will get a reference number.
          Or email <a href="#email">Bank Online</a> with your Staff ID/IPPIS No.</p></div>
      </div>
      <button className="start-button" onClick={() => document.getElementById("identify")?.scrollIntoView()}>
        Start — enter my Staff ID/IPPIS No
      </button>
      <p className="already">Already submitted? <a href="#status">Check your status / retrieve your NHF number</a></p>
      <p className="small-copy">We only ask for what is needed and we never show your details until you have proved who you are.</p>
    </section>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="step">
      <div className="step-number">{number}</div>
      <div className="step-copy"><h3>{title}</h3><p>{children}</p></div>
    </div>
  );
}

export function NhfPortal() {
  const [staffId, setStaffId] = useState("");
  const [started, setStarted] = useState(false);

  return (
    <div className="phone-page">
      <StatusBar />
      <Header />
      <main>
        <section className="hero" id="identify">
          <div className="form-card">
            <h1>Enter your Staff ID/IPPIS No</h1>
            <p className="intro">Use the Staff ID/IPPIS No your organisation gave you.</p>
            <label htmlFor="staff-id">Staff ID/IPPIS No</label>
            <input id="staff-id" value={staffId} onChange={(e) => setStaffId(e.target.value)}
              placeholder="e.g. PF1234567" />
            <button className="continue" onClick={() => setStarted(true)}>Continue</button>
            {started && <div className="success">Staff ID saved. Continue to the security check.</div>}
          </div>
          <p className="first-time">First time here? <a href="#how">Read how this works</a></p>
        </section>
        <div className="rule" />
        <HowItWorks />
        <FooterLinks />
      </main>
      <div className="help-bubble">◔</div>
      <BrowserBar />
    </div>
  );
}