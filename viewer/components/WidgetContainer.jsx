/**
 * Created by andreas on 20.11.16.
 */
var React=require('react');
var LayoutMonitor=require('./LayoutMonitor.jsx');
var ItemList=require('./ItemList.jsx');
var assign=require('object-assign');

var LayoutParameters=function(options){
    this.scale=options.scale;
    this.direction=options.direction;
    this.scalingProperty='width';
    this.multiCss='top';
    if (options.inverseAlignment) this.multiCss='bottom';
    this.containerDimension='height';
    if (options.direction == 'top' || options.direction == 'bottom') {
        this.scalingProperty='height';
        this.multiCss = 'left';
        if (options.inverseAligment) this.multiCss='right';
        this.containerDimension='width';
    }
    if (options.maxSize !== undefined && !options.scale){
        this.scaleContainer=true;
    }
};
LayoutParameters.prototype.positionProperties=function(position,multiPosition){
    var rt={left:'',top:'',bottom:'',right:''};
    rt[this.direction]=position+"px";
    rt[this.multiCss]=multiPosition+"px";
    return rt;
};
LayoutParameters.prototype.scaleProperties=function(size){
    var rt={width:'',height:''};
    rt[this.scalingProperty]=size+"px";
    return rt;
};
LayoutParameters.prototype.resetParameters=function(){
    var rt={left:'',top:'',bottom:'',right:''};
    if (this.scale){
        rt.width='';
        rt.height='';
    }
    return rt;
};
LayoutParameters.prototype.containerDimensionProperties=function(size,opt_otherSize){
    var rt={width:'',height:''};
    rt[this.containerDimension]=size+"px";
    if (this.scaleContainer ){
        rt[this.scalingProperty]=opt_otherSize+"px";
    }
    return rt;
};
/**
 * get the width and height of the container given the main property and the other property
 * @param main
 * @param otherSize
 * @returns {{width: string, height: string}}
 */
LayoutParameters.prototype.containerWidthHeight=function(main,otherSize){
    var rt={width:'',height:''};
    rt[this.containerDimension]=otherSize;
    rt[this.scalingProperty]=main;
    return rt;
};
LayoutParameters.prototype.containerResetProperties=function(){
    var rt={width:'',height:''};
    return rt;
};

var ItemWrapper=function(rect,item){
    this.rect=rect;
    this.item=item;
};
ItemWrapper.prototype.getValue=function(what,opt_other){
    if (! this.rect) {
        return 0;
    }
    return this.rect[this.getIndex(what,opt_other)];
};
ItemWrapper.prototype.getIndex=function(what,opt_swap){
    if (! opt_swap) return what;
    var swp={
        width:'height',
        height: 'width'
    };
    return swp[what];
};
ItemWrapper.prototype.getKey=function(){
    return this.item.key;
};


/**
 *
 * @param {ItemWrapper[]} itemList an array of objects to be rendered - object with keys...
 * @param {object} parameters the layout parameters
 *     direction: left|right - default left
 *     inverted: true|false - use the elements in inverse order - default false
 *     maxRowCol: 1...n the number of allowed rows, default 1
 *     outerSize: the width of the outer element
 *     maxSize: if set use this for computing scaling
 *     inverseAlignment: align to bottom instead of top, right instead of left
 *     containerClass: classes to be added to the container
 *     mainMargin: margin in px for main direction
 *     otherMargin: margin in px for other direction
 *     startMargin: margin in px for the main start
 *     scale: if set - scale items
 * @returns and object with container: main,other and styles - an object of element styles
 */
var layout=function(itemList,parameters) {
    var styles={};
    var options=avnav.assign({},parameters);
    var layoutParameter=new LayoutParameters(options);
    var numItems = itemList.length;
    if (!numItems) return {
        container: { main:0,other:0},
        styles: styles
    };
    var maxRowCol=options.maxRowCol;
    if (maxRowCol === undefined) maxRowCol=1;
    var direction=options.direction;
    var inverted=options.inverted;
    var rowColIndex,accumulatedWidthHeight,rowHeightWidth;
    var lastVisible=inverted?numItems:-1;
    var topLeftPosition=0;
    var rowStartIndex=inverted?numItems-1:0;
    var increment=inverted?-1:1;
    var i=0;
    var setMainSize=false;
    var maxWidthHeight=options.maxSize;
    var item;
    var visibleItems;
    var mainMargin=options.mainMargin||0;
    var otherMargin=options.otherMargin||0;
    var startMargin=options.startMargin||0;
    var containerMain=undefined;
    for (rowColIndex=0;rowColIndex<maxRowCol;rowColIndex++){
        var accumulatedMargin=startMargin;
        visibleItems=[];
        rowHeightWidth=0;
        elementPosition=0;
        accumulatedWidthHeight=startMargin;
        for(i=lastVisible+increment;i>=0 && i < numItems;i+=increment){
            item=itemList[i];
            if ((item.getValue(layoutParameter.scalingProperty)+accumulatedWidthHeight +mainMargin)> maxWidthHeight &&
                maxWidthHeight >0){
                break;
            }
            lastVisible=i;
            var mainSize=item.getValue(layoutParameter.scalingProperty);
            accumulatedWidthHeight+=mainSize;
            if (mainSize) {
                accumulatedWidthHeight+=mainMargin;
                accumulatedMargin+=mainMargin;
            }
            if (item.getValue(layoutParameter.scalingProperty, true) > rowHeightWidth)
                rowHeightWidth=item.getValue(layoutParameter.scalingProperty, true);
            visibleItems.push(item);
        }
        if (visibleItems.length < 1) continue;
        var vLen=visibleItems.length;
        var first=(options.outerSize > 0 && visibleItems.length > 1 && options.outerSize < maxWidthHeight/2 && options.scale);
        var usableOuterElementSize=first?options.outerSize:0;
        //if we resize the outer element - remove the outer one from the width for the factor
        var factor=1;
        if (options.scale) {
            //scale handling: as we do not scale margins, we have to subtract n times margin from both
            //the other size and the computed size
            var scaleMaxSize=maxWidthHeight-accumulatedMargin;
            accumulatedWidthHeight-=accumulatedMargin;
            if (usableOuterElementSize > 0) {
                accumulatedWidthHeight -= visibleItems[vLen - 1].getValue(layoutParameter.scalingProperty);
                //all elements without the last must fit into maxWidth-usableOuterElementSize
                factor = (accumulatedWidthHeight > 0) ? ((scaleMaxSize - usableOuterElementSize)  / accumulatedWidthHeight) : 1;
            }
            else {
                factor = (accumulatedWidthHeight > 0) ? (scaleMaxSize) / (accumulatedWidthHeight) : 1;
            }
            if (factor < 0) factor = 1
        }
        var elementPosition=startMargin;
        for (i=vLen-1;i>=0;i--){
            item=visibleItems[i];
            var niWidthHeight=first?usableOuterElementSize:(item.getValue(layoutParameter.scalingProperty)*factor);
            styles[item.getKey()]={
                position:'absolute',
                opacity:1,
                zIndex:2
            };
            var style=styles[item.getKey()];
            avnav.assign(style,layoutParameter.positionProperties(elementPosition,topLeftPosition));
            if (options.scale){
                avnav.assign(style,layoutParameter.scaleProperties(niWidthHeight));
            }
            first=false;
            elementPosition += niWidthHeight +(niWidthHeight>0?mainMargin:0);
        }
        if (containerMain === undefined || elementPosition > containerMain) containerMain=elementPosition;
        topLeftPosition+=rowHeightWidth+otherMargin;
    }
    for (i=lastVisible+increment; i < numItems && i >= 0; i+=increment) {
        styles[itemList[i].getKey()]={
            opacity:0,
            zIndex:1
        };
    }
    return {
        container:assign({other: topLeftPosition,main:containerMain,otherMargin: otherMargin,mainMargin:mainMargin},
            layoutParameter.containerWidthHeight(containerMain,topLeftPosition)),
        styles:styles
    };
};


var WidgetContainer=React.createClass({
        propTypes: {
            onItemClick: React.PropTypes.func.isRequired,
            /**
             * a list of item properties
             * must contain: key
             */
            itemList: React.PropTypes.array.isRequired,
            itemCreator: React.PropTypes.func.isRequired,
            layoutParameter: React.PropTypes.object,
            dummy: React.PropTypes.any,
            renewSequence: React.PropTypes.number,
            className: React.PropTypes.string,
            style: React.PropTypes.object,
            setContainerWidth: React.PropTypes.bool,
            setContainerHeight: React.PropTypes.bool
        },
        getInitialState: function(){
            this.itemInfo={};
            this.layouts={};
            this.renderedItems=[];
            return {};
        },
        componentWillReceiveProps:function(nextProps){
            if (nextProps.renewSequence !== undefined && nextProps.renewSequence != this.props.renewSequence){
                this.itemInfo={};
                this.layouts={};
            }
        },
        updateItemInfo:function(key,data,opt_force){
            if (! this.itemInfo) this.itemInfo={};
            if (!this.itemInfo[key]  && data != null){
                delete this.layouts[key];
                this.itemInfo[key]=data;
                this.checkUnlayouted();
                return;
            }
            if (this.itemInfo[key] && data === null){
                this.itemInfo[key]=data;
                delete this.layouts[key];
                this.checkUnlayouted();
                return;
            }
            if (opt_force ){
                if (data === null && this.itemInfo[key] === null ) return;
                if (this.itemInfo[key] != null && this.itemInfo[key] !== undefined) {
                    if (this.props.layoutParameter && this.props.layoutParameter.scale){
                        //never update if we are scaling
                        return;
                    }
                    if (data && this.itemInfo[key].width == data.width &&
                        this.itemInfo[key].height == data.height) return;
                }
                delete this.layouts[key];
                this.itemInfo[key]=data;
                this.checkUnlayouted();
            }
        },
        computeStyles:function(){
            var layoutParam={};
            if (this.props.layoutParameter){
                layoutParam=this.props.layoutParameter;
            }
            var items=[];
            this.renderedItems=[];
            if (! this.props.itemList){
                this.renderedItems=[];
                this.layouts={};
                return;
            }
            for (var i in this.props.itemList){
                var item=this.props.itemList[i];
                if (! item.key){
                    if (! item.name) {
                        avnav.log("missing item key and name");
                        continue;
                    }
                    else{
                        item=assign({key:item.name},item);
                    }
                }
                var vis=true;
                if (item.visible !== undefined && ! item.visible) {
                    vis=false;
                }
                if (this.props.visibilityFlags){
                    var flag=this.props.visibilityFlags[item.key];
                    if (flag !== undefined){
                        vis=flag;
                    }
                }
                if (! vis) continue;
                var rect=this.itemInfo[item.key];
                this.renderedItems.push(item);
                if (rect !== undefined) items.push(new ItemWrapper(rect,item))
            }
            var layouts=layout(items,layoutParam);
            this.layouts=layouts.styles;
            this.container=layouts.container;
        },
        render: function () {
            var self = this;
            this.computeStyles();
            var styles=this.layouts;
            var listProps={
                onItemClick: this.props.onItemClick,
                itemList: this.renderedItems,
                itemCreator: function(item){
                    var itemKey=item.key;
                    var style=styles[itemKey];
                    if (! style){
                        style={
                            opacity: 0,
                            backgroundColor: 'grey',
                            zIndex:1
                        }
                    };
                    var itemProperties={
                        style: style
                    };
                    var props=avnav.assign({},item,itemProperties);
                    return LayoutMonitor(self.props.itemCreator(props,self.props.store),
                        function(rect,opt_force){
                        self.updateItemInfo(itemKey, rect, opt_force);});
                },
                className: "avn_widgetContainer"
            };
            if (this.props.className !== undefined ) listProps.className+=" "+this.props.className;
            if (this.props.style) listProps.style=assign({},this.props.style);
            else listProps.style={};
            if (this.props.setContainerWidth) listProps.style.width=this.container.width||0;
            if (this.props.setContainerHeight ) listProps.style.height=this.container.height||0;
            var rt=(
                <ItemList {...listProps}
                    />
            );
            return rt;
        },
        componentDidMount: function () {
            this.componentDidUpdate();
        },
        checkUnlayouted:function(){
            var self=this;
            var hasUnlayouted=false;
            if (! this.renderedItems) return;
            for (var i in this.renderedItems){
                var key=this.renderedItems[i].key;
                if (key && (! this.layouts || ! this.layouts[key] )) {
                    //we have items that currently hav no dom with itemInfo null
                    //we simply rely on some state to change...
                    hasUnlayouted=true;
                }
            }
            if (hasUnlayouted && ! this.delayedUpdate){
                this.delayedUpdate=window.setTimeout(function(){
                    self.delayedUpdate=undefined;
                    self.setState({
                        dummy:1
                    })
                },50)
            }
        },
        componentDidUpdate:function(){
            this.checkUnlayouted();
        }
    });
module.exports=WidgetContainer;