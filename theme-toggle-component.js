// theme-toggle-component.js
class themeToggle extends HTMLElement {
  connectedCallback() {
    // Fetch b.html and insert into the component
    fetch('theme-toggle.html')
      .then(response => response.text())
      .then(html => this.innerHTML = html);
  }
}
 
// Register the custom element
customElements.define('theme-toggle', themeToggle);
