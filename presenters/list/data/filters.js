import Menu from '../../menu'
import Dialog from '../../dialog'
import Popover from '../../popover'
import titleize from '../../../util/titleize'
import Fuse from 'fuse.js'
import Emitter from 'component-emitter'

import Presets from './filter-presets'
import FilterViewDate from '../toolbar/filter-view/date'
import FilterViewInput from '../toolbar/filter-view/input'
import FilterViewSlider from '../toolbar/filter-view/slider'
import FilterViewSearch from '../toolbar/filter-view/search'
// import FilterViewToken from '../toolbar/filter-view/token'

const CustomViews = {
    'date': FilterViewDate,
    'input': FilterViewInput,
    'slider': FilterViewSlider,
    'search': FilterViewSearch,
    // 'token': FilterViewToken
}

// do NOT include 0 or false as unset values
const unsetValues = [undefined, null, '']

const defaultSearch = model => {
    let data = {};
    ['id', 'title', 'name', 'label', 'file', 'dir'].forEach(key=>{
        if( model.has !== undefined ){
            if( model.has(key) )
                data[key] = model.get(key)
        }else if( model[key] !== undefined )
            data[key] = model[key]
    })
    return data;
};

const defaultFilterby = (model, val, key) => {
    if( Array.isArray(val) )
        return val.includes(model.get(key))
    else
        return val == (model.get ? model.get(key) : model[key])
};

export default class Filters extends Map {

    get _storeKey(){ return 'b-list:'+this.key+':filters' }

    reset(values={}, {stopQueuing=true, silent=false}={}){
        this.queuedChanges = null
        
        if( stopQueuing )
            this.queuing = false

        let resetData = {}
        this.map(filter=>{
            resetData[filter.key] = values[filter.key] !== undefined ? values[filter.key] : filter.defaultVal
        })

        this.value(resetData, {silent})

        if( silent !== true )
            this.emit('reset')
    }

    toString(){
        let active = []
        this.forEach(filter=>{
            if( filter.isActive )
                active.push(`${filter.label}: ${filter.valueLabel}`)
        })

        return active.join(' | ')
    }

    get length(){ return Object.keys(this.value()).length}

    // alias that makes more sense when working programically
    update(filters, opts){
        this.value(filters, opts)
    }

    get areApplied(){
        return Object.keys(this.value()).length > 0
    }

    value(key, val, opts={}){
        // first time getting value, get it from local storage
        if( this.__value === undefined ){
            this.__value = this.key && JSON.parse(localStorage.getItem(this._storeKey)) || {}
        }

        // SETTING
        if( val !== undefined || typeof key == 'object' ){

            this.lastChanged = new Date().getTime()
            
            // may be setting more than one value
            let changes = typeof key == 'object' ? key : {[key]:val}
            let didChange = []

            if( typeof key == 'object' )
                opts = val || {}

            for( let k in changes){
                
                let changeFrom = this.__value[k]
                let changeTo = changes[k]

                // is the selected value effectively "unset" (`multi` filters will be an array: `[null]` )
                if( [null, undefined].includes(changeTo)
                || (Array.isArray(changeTo) && [null, undefined].includes(changeTo[0]) ) )
                    delete this.__value[k]
                else
                    this.__value[k] = changeTo

                // converting to JSON string so we can compare arrays
                if( JSON.stringify(this.__value[k]) != JSON.stringify(changeFrom) ){
                    didChange.push(k)
                }else{
                    delete changes[k]
                }
            }
            
            if( this.key )
                localStorage.setItem(this._storeKey, JSON.stringify(this.__value))

            if( didChange.length > 0 ){
                // emit a change on each filter
                didChange.forEach(k=>{
                    let filter = this.get(k)    
                    if( filter.isCustomView )
                        filter.customView.value = this.value(k)
                    filter.emit('change', this.value(k))
                })

                if( this.queuing ){
                    this.queuedChanges = changes
                    if( opts.silent !== true )
                        this.emit('change-queue', changes)
                }else if( opts.silent !== true )
                    this.emit('change', changes)
            }

        // GETTING
        }else{
            return key ? this.__value[key] : Object.assign({}, this.__value)
        }
    }

    toPostData(){
        let value = this.value()
        let data = {}

        for( let key in value ){
            let d = value[key]
            // only send "values" from the `search` filter view
            if( Array.isArray(d) )
                data[key] = d.map(item=>{
                    return item.val != undefined && item.selection == undefined 
                            ? item.val
                            : item
                })
            else
                data[key] = d
        }

        return data
    }

    get queuing(){return this.__queue || false }
    set queuing(val){
        this.__queue = Boolean(val)

        if( !this.queuing && this.queuedChanges ){
            this.emit('change', this.queuedChanges)
            this.queuedChanges = null
        }
    }

    get queuedChanges(){ return this.__queuedChanges }
    set queuedChanges(changes){
        if( !changes ){
            delete this.__queuedChanges
            this.emit('queuing', false)
            return
        }

        this.__queuedChanges = Object.assign((this.__queuedChanges || {}), changes)

        this.emit('queuing', Object.keys(this.__queuedChanges).length )
    }

    use(filters){
        
        if( filters == this.__lastFilters )
            return

        this.__lastFilters = filters

        this.forEach(filter=>delete filter.parent)
        this.clear()

        let options = {}
        let presets = []

        for( let key in filters ){

            if( !filters[key] )
                continue

            if( key == 'search' ){
                this.searchOptions = filters[key]
                continue
            }

            if( key == 'presets' ){
                presets = filters[key]
                continue;
            }

            if( key == 'options' ){
                options = filters[key]
                continue;
            }

            let filter = new Filter(key, filters[key])
            filter.parent = this
            this.set(key, filter)
        }

        this.opts = Object.assign({
            overflowThreshold: 8,
            overflowThresholdMobile: 3,
            presets: presets === false ? false : true
        }, options)

        if( presets )
            this.presets.set(presets)

        this.lastChanged = new Date().getTime()
    }

    map(fn){
        let resp = []
        this.forEach((v, key)=>resp.push(fn(v, key)))
        return resp
    }

    get presets(){
        this.__presets = this.__presets || new Presets()
        this.__presets.filters = this
        return this.__presets
    }

    set searchOptions(opts){
        if( opts === false || opts === null )
            this.__searchOptions = {data:false} // turns search off

        if( typeof opts == 'object' )
            this.__searchOptions = opts
    }
    
    get searchOptions(){
        return Object.assign({
            data: defaultSearch,
            includeMatches: true,
            minMatchCharLength: 3,
            threshold: 0.2,
            location: 0,
            distance: 100,
            placeholder: 'Search',
            delay: 0
        }, this.__searchOptions||{})
    }

    get showSearch(){
        return !!this.searchOptions.data && this.searchOptions.hideIcon!==true
    }

    filterByTerm(data){
        return new Promise(resolve=>{
            
            let searchOptions = Object.assign({}, this.searchOptions)
            let keys = searchOptions.keys

            data.forEach(m=>{
                m.searchMatches = {}
            })

            if( !this.term 
            || (!searchOptions.data || searchOptions.data === 'db' || searchOptions.db )
            || this.term.length < searchOptions.minMatchCharLength )
                return resolve(data)

            data.forEach(m=>{
                m._fuseSearch=searchOptions.data(m)

                // no search option keys set yet, so set them automatically
                if( !keys )
                    keys = Object.keys(m._fuseSearch)
            })

            // prefix all keys with `_fuseSearch.` so the data is searched properly
            // keys can be an array of strings or objects with name/weight
            if( keys )
            searchOptions.keys = keys.map(key=>{
                if( typeof key == 'string' )
                    return '_fuseSearch.'+key
                
                let newKey = Object.assign({}, key)
                newKey.name = '_fuseSearch.'+newKey.name
                return newKey
            })

            let fuse = new Fuse(data, searchOptions)
            data = fuse.search(this.term)

            // reformat to array of models
            if( searchOptions.includeMatches )
                data = data.map(d=>{
                    d.item.searchMatches = {}
                    d.matches.forEach(m=>{
                        d.item.searchMatches[m.key.replace('_fuseSearch.', '')] = m.value
                    })
                    return d.item
                })

            resolve(data)
        })
    }

    async filter(data){
        let filters = this.map(filter=>filter)

        // apply each filter, waiting for the first one to finish before moving on to the next filter
        return filters.reduce((promise, filter) => {
            return promise.then(data=>filter.filterData(data));
        }, Promise.resolve(data))

    }

    needsDatabaseFetch(changes){
        for( let key in changes ){
            if( this.get(key).isDB )
                return true
        }
        return false
    }

}

/*
    Filter
*/
export class Filter {

    constructor(key, attrs){
        this.key = key
        this.attrs = attrs
    }

    get values(){
        // TODO: implement "context" for function?
        let values = this.attrs.values
        values = typeof values == 'function' ? values.call(this.parent.list, this) : values

        values = values.map(v=>{
            if( typeof v == 'string' && !['divider', '-'].includes(v) )
                v = {label: v, val: v}

            // make "unset" values uniform
            if( typeof v == 'object' && unsetValues.includes(v.val) ){
                v.val = null
                v.clearsAll = true
            }

            return v
        })

        return values
    }

    get label(){
        return this.attrs.label || titleize(this.key)
    }

    get icon(){
        return this.attrs.icon || null
    }

    get filterBy(){
        if( !this.attrs.filterBy && this.isCustomView && this.customView.filterBy )
            return this.customView.filterBy

        return this.attrs.filterBy || defaultFilterby
    }

    // is a database filter
    get isDB(){
        return this.attrs.db === true
    }

    get isCustomView(){
        return !!this.attrs.view
    }

    get isActive(){
        let val = this.isMulti ? this.value&&this.value[0] : this.value
        return !unsetValues.includes(val)
    }

    get isMulti(){
        return this.attrs.multi === true
    }

    get value(){
        return this.parent.value(this.key)
    }

    set value(val){
        this.parent.value(this.key, val)
    }

    get defaultVal(){
        if( this.attrs.defaultVal ) return this.attrs.defaultVal
        
        if( this.isCustomView )
            return this.customView.defaultVal ? this.customView.defaultVal : null

        let first = this.values[0]
        return first ? first.val : null
    }

    get valueLabel(){
        let val = this.value
        
        if( Array.isArray(val) )
            val = val.map(v=>v.val||v)
        else
            val = val&&(val.val||val)

        if( this.isCustomView ){
            let view = this.customView
            return view ? view.label : 'UNSUPORRTED'
        }

        let matchedVal = this.values.filter((v,i)=>{
            if( typeof v == 'string' || v.divider || v.text || v.noDisplay ) return false
            // return v.val==val

            if( !Array.isArray(val) ){
                if( v.val==val ){
                    Object.assign(v, this.value)
                    return true
                }
                return false
            }

            let matchedIndex = val.indexOf(v.val)

            if( matchedIndex > -1 ){
                
                let mergeData = this.value[matchedIndex]
                
                if( mergeData && typeof mergeData == 'object' ){
                    Object.assign(v, mergeData)
                }

                return true
            }
            
            return false
        })

        if( matchedVal&&matchedVal.length>0 )
            return matchedVal.map(f=>{
                return [f.selection, f.toolbarLabel||f.label].filter(s=>s).join(' ')
            }).join(', ')
        
        if( Array.isArray(val) )
            return this.value.map(v=>{
                return [v.selection, v.val].filter(s=>s).join(' ')
            }).join(', ')

        return val
    }

    async showMenu(el, opts={}){

        if( this.isCustomView  )
            return this.showCustomView(el, opts)

        if( this.attrs.onFirstLoad ){
            el.spin = true
            await this.attrs.onFirstLoad.call(this.parent.list, this)
            el.spin = false
        }
            

        let selected = await new Menu(this.values, {
            selected: this.value,
            multiple: this.isMulti,
            width: this.attrs.width||null
        }).popover(el, Object.assign({
            overflowBoundry: this.attrs.overflowBoundry || 'scrollParent',
            maxHeight: this.attrs.maxHeight || '60vh',
            align: this.attrs.align || 'bottom',
            adjustForMobile: true
        }, opts))

        let oldVal = this.value

        if( selected === false || selected.length == 0  ) return
            // this.value = null
        else if( Array.isArray(selected))
            this.value = selected.map(s=>{
                return s.selection ? {val: s.val, selection: s.selection} : s.val
            })
        else
            this.value = selected.selection ? {val: selected.val, selection: selected.selection} : selected.val
    }

    get customView(){
        let viewName = this.attrs.view
        let View = null

        if( !this._customView ){

            if( CustomViews[viewName] ){
                View = CustomViews[viewName]
            }else if( typeof viewName == 'string' ) {
                View = customElements.get(viewName)
            }else if( typeof viewName == HTMLElement ){
                View = viewName
            }

            if( View ){
                View.prototype.close = function(){
                    this.popover&&this.popover._close() // to trigger onClose
                }
                this._customView = new View((this.attrs.viewOpts||{}))
                this._customView.filter = this
            }
        }

        return this._customView
    }

    async showCustomView(el, opts){

        if( !this.customView )
            return Dialog.warn({msg:`${this.key}: unsupported view`}).popover(el)
        
        let onClose = _=>{
            // let menu close before attempting to set value
            // with larger datasets, a user can feel it lag for a split second
            setTimeout(()=>{
                this.value = this.customView.value
                this.customView.didClose&&this.customView.didClose()
            })
        }
        
        // TODO: support `adjustForMobile`
        new Popover(el, this.customView, Object.assign({
            width: this.attrs.width||null,
            maxHeight: this.attrs.maxHeight || '60vh',
            align: this.attrs.align || 'bottom',
            // adjustForMobile: true

            onClose: onClose,
            onKeydown: (...args)=>{
                if( this.customView.onKeydown ){
                    this.customView.onKeydown(...args)
                }
            }
        }, opts))
    }

    filterData(data){
        return new Promise(resolve=>{

            // pass through the data unchanged if any of these are met
            if( !this.isActive ) return resolve(data)
            if( !this.filterBy ) return resolve(data)
            if( this.isDB ) return resolve(data)

            let val = this.value
            data = data.filter(m=>this.filterBy.call(this.parent.list, m, val, this.key))
            resolve(data)
        })
    }

}

Emitter(Filters.prototype)
Emitter(Filter.prototype)