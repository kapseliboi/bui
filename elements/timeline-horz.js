import { LitElement, html, css } from 'lit-element'

customElements.define('b-timeline-horz', class extends LitElement{

    static get listeners(){return {
        model: {'change': 'requestUpdate'}
    }}

    static get styles(){return css`
        :host {
            position:relative;
            display: grid;
            grid-template-columns: 4em max-content 1fr;
            gap: 1em;
        }

        .date {
            text-align: right;
            line-height: 1em;
            margin-top: .2em;
        }

        .date small {
            opacity: .5;
        }

        :host([late]) .date {
            color: var(--red);
        }

        .line {
            display: flex;
            justify-content: stretch;
            flex-direction: column;
        }

        .line b-hr {
            margin: 0 auto;
            flex: 1;
            --bgd: var(--theme-bgd-accent);
            width: 3px;
            /* min-height: 40px; */
        }

        :host([done]) .line b-hr {
            --bgd: var(--green);
            /* --bgd: linear-gradient(to bottom, var(--green) 50%, var(--theme-bgd-accent) 50%); */
        }

        .bubble {
            position: relative;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 1.6em;
            width: 1.6em;
            border-radius: 1em;
            background: var(--b-timeline-bubble-bgd, var(--theme-bgd-accent));
            color: var(--theme-color-accent);
            transition: 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }
        

        .bubble b-icon {
            font-size: 1.6em;
            color: var(--theme-color);
        }

        :host([late]) .bubble {
            background: none;
        }

        :host([started]) .bubble b-icon {
            color: var(--blue);
        }

        :host([late]) .bubble b-icon {
            color: var(--red);
        }

        :host([done]) .bubble b-icon {
            color: var(--green);
        }

        .content {
            padding-bottom: 1.6em;
        }

        @media (hover) {
            .bubble:hover {
                transform: scale(1.25);
            }
        }
    `}

    render(){return html`
         
        <div class="date">
            ${this.renderDate()}
        </div>

        <div class="line">
            <div class="bubble" @click=${this.onBubbleClick}>
                ${this.renderBubble()}
            </div>
            <b-hr vert></b-hr>
        </div>
        
        <div class="content">
            ${this.renderContent()}
        </div>
    `}

    renderDate(){ return html`<slot name="date"></slot>` }
    renderBubble(){ return html`<slot name="bubble"></slot>` }
    renderContent(){ return html`<slot></slot>` }

    onBubbleClick(){}

})

export default customElements.get('b-timeline-horz')