import { LitElement, html, css } from 'lit-element'

customElements.define('b-code', class extends LitElement{

    static get styles(){return css`

        :host {
            background: var(--theme-bgd-accent, #ccc);
            color: var(--theme-text, inherit);
            border-radius: 3px;
            padding: 0 .3em;
            display: inline-block;
        }

        code {
            color: inherit;
        }

        :host([block]) {
            display: block;
            font-family: monospace;
            padding: 1em;
            overflow-x: auto;
        }

        :host([block]) code {
            white-space: pre-wrap;
        }
    `}

    connectedCallback(){
        super.connectedCallback()
        this.textContent = this.textContent.trim()
    }

    render(){return html`
        <code><slot></slot></code>
    `}

})

export default customElements.get('b-code')