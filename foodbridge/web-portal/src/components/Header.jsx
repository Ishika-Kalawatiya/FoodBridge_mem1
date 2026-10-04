export default function Header({ user, onSignOut }) {
  return (
    <header className="site-header">
      <a className="brand" href="#home" aria-label="FoodBridge home"><span className="brand-mark">f<span>+</span></span><span>foodbridge<small>GOOD FOOD GOES FURTHER</small></span></a>
      <nav className="main-nav" aria-label="Main navigation">
        <a href="http://localhost:5173" target="_blank" rel="noreferrer">Rescue Run <span>↗</span></a>
        <a href="#map">Map</a>
        <a href="#leaderboard">Leaderboard</a>
      </nav>
      <button className="user-menu" onClick={onSignOut} title={`Sign out ${user.name}`}><span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span><span className="user-menu-name">{user.name.split(" ")[0]}</span><span className="signout-arrow">⌄</span></button>
    </header>
  );
}
