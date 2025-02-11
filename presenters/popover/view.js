import { LitElement, html, css } from 'lit-element'
import Popover from './index'

customElements.defineShared('b-popover-view', class extends LitElement{

    static get styles(){return css`
        :host {
            display: block;
            position:relative;
            width: 300px;
            padding: 1em;
            padding-bottom: .5em;
        }
    `}

    constructor(){
        super()
        this.addEventListener('mouseover', this.stopAutoClose)
    }

    async open(id, target, opts){
        this.close()

        this.load(id)

        new Popover(target, this, opts)
    }

    load(id){

    }

    close(){
        this.stopAutoClose()
        this.popover&&this.popover.close()
    }

    openIfHovered(id, target, {delay=700, opts}={}){

        function onMouseOut(){ 
            this.autoClose()
            clearTimeout(target._entityQuickViewTimeout)
        }

        target.addEventListener('mouseout', onMouseOut.bind(this), {once: true})
        this.addEventListener('mouseout', this.close.bind(this), {once: true})

        target._entityQuickViewTimeout = setTimeout(()=>{
            
            this.open(id, target, opts)

        }, delay)
    }

    stopAutoClose(){
        clearTimeout(this._autoCloseTimeout)
    }

    autoClose(delay=300){
        this._autoCloseTimeout = setTimeout(()=>{
            this.close()
        }, delay)
    }

})

export default customElements.get('b-popover-view')