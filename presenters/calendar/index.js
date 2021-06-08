import { LitElement, html } from 'lit-element'
// import {live} from 'lit-html/directives/live'
import 'lit-virtualizer'
import dayjs from 'dayjs'
import styles from './styles'
import './month'
// import './presets'
import {dateRange, daysForDate} from './util'

customElements.define('b-calendar', class extends LitElement{

    static get styles(){return styles}

    static get properties(){return {
        value: {type: String},
        min: {type: String},
        max: {type: String},
        range: {type: Boolean, reflect: true},
        // inputs: {type: Boolean, reflect: true},
        // btns: {type: Boolean, reflect: true},
        active: {type: String, reflect: true},
        inView: {type: Object}
        // presets: {type: Array}
    }}
    
    constructor({
        range = true,
        // inputs = true,
        // btns= true,
        value = new Date(),
        min = '1975-01-01',
        max = '2099-12-31',
        // presets = [],
    }={}){
        super()

        this.range = range
        // this.inputs = inputs
        // this.btns = btns
        this.value = value
        this.min = min
        this.max = max
        this.active = 'start'
        // this.presets = range ? presets : false

        this.onSelectedRangeChange.bind(this)
        this.daysHeader = dayjs.weekdaysShort()

        this.applyMonths()
    }

    set value(val){

        if( !val ) return
        
        if( !Array.isArray(val) ){
            
            if( typeof val == 'string' )
                val = val.split(',')
            else
                val = [val.start||val, val.end||val]

            val[1] = val[1] || val[0]
        }

        if( this.selectedRange ){
            this.selectedRange.range = val
            this.scrollToDate(this.selectedRange.active)
        }else{
            this._value = val
        }
    }
    
    get value(){
        if( this.range )
            return {start: this.selectedRange.start, end: this.selectedRange.end}
        else
            return this.selectedRange.start
    }

    get label(){
        return this.selectedRange.label
    }

    applyMonths(){

        let min = dayjs(this.min).startOf('day')
        let max = dayjs(this.max).endOf('day')

        if( !this.selectedRange ){

            let [start, end] = this._value||[]
            delete this._value
            this.selectedRange = dateRange(start, end, {min, max, range:this.range})
        }

        this.months = []
        while( min.isBefore(max) ){
            
            let d = min.clone()
            d.calendarDays = daysForDate(d)
            
            this.months.push(d)

            min = min.add(1, 'month')
        }
    }

    firstUpdated(){
        this.scroller = this.$$('lit-virtualizer')
        this.selectedRange.on('change', this.onSelectedRangeChange.bind(this))
    }

    connectedCallback(){
        super.connectedCallback()
        
        setTimeout(() => {
            this.scrollToDate('start')
        }, 1);
    }

    render(){return html`


        <header part="header">
            
            <b-text xl bold>
                ${this.inView?html`${this.inView.date.format('MMMM YYYY')}`:''}&nbsp;
            </b-text>

            <div class="nav">
                <slot name="before-nav"></slot>
                <div>
                    <b-btn text icon="left-open-big" @click=${this.prevMonth}></b-btn>
                    <b-btn text @click=${this.goToToday}>Today</b-btn>
                    <b-btn text icon="right-open-big" @click=${this.nextMonth}></b-btn>
                </div>
                <slot name="after-nav"></slot>
            </div>

        </header>

        <div part="months-header" class="day-header">${this.daysHeader.map(day=>html`
            <div>${day}</div>
        `)}</div>
        
        <lit-virtualizer
            part="months"
            .items=${this.months}
            .renderItem=${this.renderMonth.bind(this)}
            @date-selected=${this.onDateSelected}
            @month-in-view=${this.onMonthInView}
        ></lit-virtualizer>

        <footer>
        </footer>
    `}

    onMonthInView(e){
        let month = e.detail
        if( this.inView )
            this.inView.removeAttribute('inviewport')
        
        this.inView = month
        this.inView.setAttribute('inviewport', '')
    }

    renderMonth(date){return html`
        <b-calendar-month 
            .date=${date}
            .selectedRange=${this.selectedRange}
        ></b-calendar-month>
    `}

    scrollToDate(date='start', location='center'){

        if( !this.scroller ) return

        if( ['start', 'end'].includes(date) ) 
            date = this.selectedRange[date]
            
        let index = this.months.findIndex(m=>m.isSame(date, 'month'))
        
        if( index > -1 )
            this.scroller.scrollToIndex(index, location)
    }

    nextMonth(){
        this.scrollToDate(this.inView.date.add(1, 'month'), 'start')
	}

	prevMonth(){
        this.scrollToDate(this.inView.date.add(-1, 'month'), 'start')
	}

    goToToday(){
        this.scrollToDate(dayjs(), 'start')
    }

    cancelDate(){
        this.emitEvent('cancel')
        this.emitEvent('done', {action: 'cancel'})
    }

    applyDate(){
        this.emitEvent('apply', this.value)
        this.emitEvent('done', {action: 'apply', value: this.value})
    }

    onSelectedRangeChange(prop, val){
        if( prop == 'active' )
            return this.active = val

        this.update()
    }

    /* calendar */
    onDateSelected(e){
        let {date, month} = e.detail
        
        if( date )
            this.selectedRange[this.selectedRange.active] = date

        if( month ){
            if( this.range )
                this.selectedRange.range = [month.startOf('month'), month.endOf('month')]
            else
                e.stopPropagation()
        }
    }

})

export default customElements.get('b-calendar')


