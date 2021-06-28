import { LitElement, html, css } from 'lit-element'
import scrollbars from '../../helpers/scrollbars'

customElements.define('b-list-header', class extends LitElement{

    static get sharedStyles(){ return css`
        :host {
            display: grid;
            grid-template-columns: var(--grid-template-cols);
        }

        :host > * {
            position: relative;
            padding: .5rem;
            border-bottom: solid 1px var(--border-color, rgba(var(--theme-text-rgb), .1));
        }
    `}

    constructor(){
        super()
        this.slot = "header"
    }

    static get styles(){return [this.sharedStyles, css`

        ${scrollbars.hide()}

        div {
            font-size: .8em;
            font-weight: bold;
        }
    `]}

    firstUpdated(){
        scrollbars.stopWheelScrolling(this)

        let children = Array.from(this.shadowRoot.children)

        let prevW = null
        let widths = children.map(c=>{

            if( c.tagName == 'STYLE' ) return false

            let w = c.getAttribute('w') || prevW || false
            prevW = w

            return w

        }).filter(w=>w!==false)

        this.parentElement.style.setProperty('--grid-template-cols', widths.join(' '))
    }

    render(){return html`
        ${this.content()}
    `}

    content(){
        let rowEl = customElements.get(this.parentElement.rowElement)
        if( !rowEl ) return html``

        let styles = rowEl.sharedStyles || this.constructor.sharedStyles
        let render = (rowEl.header&&rowEl.header()) || ''

        return html`
            <style>${styles}</style>
            ${render}
        `
    }
})

export default customElements.get('b-list-header')