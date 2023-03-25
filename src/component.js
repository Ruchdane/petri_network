class Component{
    static line = null;
    static src = null;
    static state = null;
    static initSvgEvents(svg){
	    svg.addEventListener("mousemove", (e)=>{
	        if(Component.line){
		        Component.line.dest_x = e.clientX;
		        Component.line.dest_y = e.clientY;
		        Component.line.redraw();
	        }
	    });

	    svg.addEventListener("mouseup", (e)=>{
	        console.log('mouseUP SVG');
	        if(Component.line){
		        Component.line.removeFromDOM();
		        Component.line = null;
		        Component.src = null;
		        Component.state = null;
	        }
	    });
    }
    constructor(type, props){

	    if (!type || !props)
	        throw new Error("missing parameter");
	    else if ((type != 'place' && type != 'edge' && type != 'transition') ||
		         typeof props != 'object')
	        throw new Error("wrong parameter");

	    this.type = type;

	    if(props.x >= 0 && props.y >= 0){
	        var lyt = layout.fixPoint(props.x, props.y);
	        props.x = lyt.x;
	        props.y = lyt.y;
	    }else{
	        props.x = 0;
	        props.y = 0;

	    }

	    props.cWidth = layout.cellW;
	    props.cHeight = layout.cellH;
	    this.comp = Factory.getShape(type, props);
	    if(this.comp == null)
	        throw new Error ("instantiation failed");
	    if(type=='transition' || type == 'place')
	        layout.mark(Math.floor(props.x/layout.cellW), Math.floor(props.y/layout.cellH));
	    Register.add(this.type == 'edge'?
		             this.comp.shape.line.uuid :
		             this.comp.shape.uuid, this);
    }
    edgeCompleted(){
        var e;
	    if(!Component.line)
	        return;

	    console.log('completed type='+this.type+ ' x2='+ this.comp.shape.shape.x);
	    Component.line.removeFromDOM();

        /* Only p2t  and t2p are allowed */
	    if(Component.src.type != this.type){
            var count = {count: 0};

	        e = new Component('edge', {
		        direction:this.type=='place'?'t2p':'p2t',
		        src: Component.src.comp.shape.uuid,
		        dest: this.comp.shape.uuid
	        });
            e.comp.shape.redraw();
	        layout.markEdge(Math.floor(Component.src.comp.shape.shape.x/layout.cellW),
			                Math.floor(Component.src.comp.shape.shape.y/layout.cellH),
			                Math.floor(this.comp.shape.shape.x/layout.cellW),
			                Math.floor(this.comp.shape.shape.y/layout.cellH));

            /* Set xor_join if transition has more than one place associated */
            if(this.type == 'transition'){
                Register.forEach(
		            (item, data)=>{
                        console.log('Register');
                        if(item.type=='edge' &&
		                   (item.comp.src == this.comp.shape.uuid ||
			                item.comp.dest == this.comp.shape.uuid)){
                            data.count++;
			                //data.push(item);
		                }
		            },
		            count);
                if(count.count >= 2)
                    this.comp.setGate('xor_join');
            }
	    }

	    Component.line = null;
	    Component.src = null;
	    Component.state = null;
    }
    
    addConnector(type){
	    this.comp.removePanel();
	    if(type == this.type)
	        return;

	    if(type == 'edge'){
	        console.log('addconnector edge');
	        Component.state = 'linking'
	        Component.src = this;
	        Component.line = aya.Line(this.comp.shape.shape.c_points[0].x, this.comp.shape.shape.c_points[0].y);
	        Component.line.draw();

	    }else if(type == 'transition' || type == 'place'){
	        var props = {}, tr, pos, edge, step, i, posx, posy;

	        if(type == 'place')
		        props.type = 'intermediary';
	        else
		        props.type = 'dummy'

	        /* TODO: genereate name*/
	        props.name = 'generate automatic name';
	        console.log('addconnector');

	        posx = Math.floor(this.comp.shape.shape.x/layout.cellW);
	        posy = Math.floor(this.comp.shape.shape.y/layout.cellH);
	        if((pos=layout.getClosestPosition(posx, posy))){
		        props.x = pos.x*layout.cellW;
		        props.y = pos.y*layout.cellH;
	        }else{
		        props.x = 0;
		        props.y = 0;

		        pos.x = 0;
		        pos.y = 0;
	        }

	        props.cWidth = layout.cellW;
	        props.cheight = layout.cellH;

	        layout.markEdge(posx, posy, pos.x, pos.y);

	        tr = new Component(type, props);
	        edge = new Component('edge', {
		        direction: type=='transition'? 'p2t': 't2p',
		        src: this.comp.shape.uuid,
		        dest: tr.comp.shape.uuid
	        });
            edge.comp.shape.redraw();
	    }
	    else if(type == 'deletion'){
	        var edges = [], src, dest;

	        Register.forEach(
		        (item, data)=>{
		            if(item.type=='edge' &&
		               (item.comp.src == this.comp.shape.uuid ||
			            item.comp.dest == this.comp.shape.uuid)){
			            data.push(item);
		            }
		        },
		        edges);

	        edges.map((lk) => {
		        console.log('MAP edges');
		        src = Register.find(lk.comp.src);
		        dest = Register.find(lk.comp.dest);

		        console.log(src);
		        console.log(dest);
		        layout.umarkEdge(Math.floor(src.comp.shape.shape.x/layout.cellW),
				                 Math.floor(src.comp.shape.shape.y/layout.cellH),
				                 Math.floor(dest.comp.shape.shape.x/layout.cellW),
				                 Math.floor(dest.comp.shape.shape.y/layout.cellH));

		        lk.comp.shape.line.removeFromDOM();
		        Register.clear(lk.comp.shape.line.uuid);

	        });

	        layout.umark(Math.floor(this.comp.shape.shape.x/layout.cellW),
			             Math.floor(this.comp.shape.shape.y/layout.cellH));
	        this.comp.shape.shape.svg.removeChild(this.comp.shape.shape.c_svg);
	        Register.clear(this.comp.shape.uuid);
	    }
	    else if(type == 'andsplit'){
	        var i, lyt, p, t, e, cur, obj={};

	        for(i=0; i<2; i++){
		        cur = this;

		        lyt = layout.getClosestPosition(Math.floor(cur.comp.shape.shape.x/layout.cellW),
						                        Math.floor(cur.comp.shape.shape.y/layout.cellH));

		        obj.x = lyt.x*layout.cellW;
		        obj.y = lyt.y*layout.cellH;
		        obj.type = 'intermediary';
		        p = new Component('place', obj);
		        e = new Component('edge', {src: cur.comp.shape.uuid,
					                       dest: p.comp.shape.uuid,
					                       direction: 't2p'});
                e.comp.shape.redraw();

		        cur = p;
		        lyt = layout.getClosestPosition(Math.floor(cur.comp.shape.shape.x/layout.cellW),
						                        Math.floor(cur.comp.shape.shape.y/layout.cellH));
		        obj.x = lyt.x*layout.cellW;
		        obj.y = lyt.y*layout.cellH;
		        obj.type = 'dummy';
		        t = new Component('transition', obj);
		        e = new Component('edge', {src: cur.comp.shape.uuid,
					                       dest: t.comp.shape.uuid,
					                       direction: 'p2t'});
                e.comp.shape.redraw();
	        }
	    }else if(type == 'dowhile'){
	        var i, lyt, p, t, e, obj={};

	        lyt = layout.getClosestPosition(Math.floor(this.comp.shape.shape.x/layout.cellW),
	    					                Math.floor(this.comp.shape.shape.y/layout.cellH));

	        obj.x = lyt.x*layout.cellW;
	        obj.y = lyt.y*layout.cellH;
	        obj.type = 'intermediary';
	        p = new Component('place', obj);

	        lyt = layout.getClosestPosition(Math.floor(p.comp.shape.shape.x/layout.cellW),
	    					                Math.floor(p.comp.shape.shape.y/layout.cellH));
	        obj.x = lyt.x*layout.cellW;
	        obj.y = lyt.y*layout.cellH;
	        obj.type = 'dummy';
	        t = new Component('transition', obj);

            e = new Component('edge', {src: this.comp.shape.uuid,
	    				               dest: p.comp.shape.uuid,
	    				               direction: 't2p'});
            e.comp.shape.redraw();

            e = new Component('edge', {src: p.comp.shape.uuid,
	    				               dest: this.comp.shape.uuid,
	    				               direction: 'p2t'});
            e.comp.shape.redraw();

            e = new Component('edge', {src: p.comp.shape.uuid,
	    				               dest: t.comp.shape.uuid,
	    				               direction: 'p2t'});
            e.comp.shape.redraw();
            this.comp.setGate('xor_join');
	    }else if (type == 'setting'){
	        var name = window.prompt("Name of the place :");
	        this.comp.setName(name);
	        var type = window.prompt("Type of the place :");
	        this.comp.setType(type);
	    }
    }
    
    onMouseDown(){
	    Component.state = 'moving';
	    Component.x = this.comp.shape.shape.x;
	    Component.y = this.comp.shape.shape.y;
    }

    onMouseUp(uuid){
	    console.log('mouseUp state='+Component.state);
	    if(Component.state == 'linking')
	        this.edgeCompleted(uuid);
	    else if(Component.state == 'moving'){
	        var lyt = layout.fixPoint(this.comp.shape.shape.x,
				                      this.comp.shape.shape.y);
	        var edges = [], src, dest, osrc, odest;

	        this.comp.shape.shape.x = lyt.x;
	        this.comp.shape.shape.y = lyt.y;
	        this.comp.redraw(layout.cellW, layout.cellH);

	        Register.forEach(
		        (item, data)=>{
		            if(item.type=='edge' &&
		               (item.comp.src == this.comp.shape.uuid ||
			            item.comp.dest == this.comp.shape.uuid))
			            data.push(item);
		        },
		        edges);

	        if(!edges.length){
		        layout.umark(Math.floor(Component.x/layout.cellW),
			                 Math.floor(Component.y/layout.cellH));
		        layout.mark(lyt.x/layout.cellW,  lyt.y/layout.cellH);
	        }else{
		        edges.map((e)=>{
		            if(e.comp.src == this.comp.shape.uuid){
			            dest = Register.find(e.comp.dest);
			            odest = {
			                x: dest.comp.shape.shape.x,
			                y: dest.comp.shape.shape.y
			            };
			            src = this;
			            osrc = {
			                x: Component.x,
			                y: Component.y
			            };
			            e.comp.shape.line.x = this.comp.shape.shape.c_points[3].x;
			            e.comp.shape.line.y = this.comp.shape.shape.c_points[3].y;

		            }
		            else{
			            src = Register.find(e.comp.src);
			            osrc = {
			                x: src.comp.shape.shape.x,
			                y: src.comp.shape.shape.y
			            };

			            dest = this;
			            odest = {
			                x: Component.x,
			                y: Component.y
			            };
			            e.comp.shape.line.dest_x = this.comp.shape.shape.c_points[3].x;
			            e.comp.shape.line.dest_y = this.comp.shape.shape.c_points[3].y;
		            }

		            layout.umarkEdge(Math.floor(osrc.x/layout.cellW),
				                     Math.floor(osrc.y/layout.cellH),
				                     Math.floor(odest.x/layout.cellW),
				                     Math.floor(odest.y/layout.cellH));

		            layout.markEdge(Math.floor(src.comp.shape.shape.x/layout.cellW),
				                    Math.floor(src.comp.shape.shape.y/layout.cellH),
				                    Math.floor(dest.comp.shape.shape.x/layout.cellW),
				                    Math.floor(dest.comp.shape.shape.y/layout.cellH));

		            e.comp.shape.redraw();
                });
	        }
	    }
	    Component.state = null;
    }

    save(container){
	    var obj = {};
	    this.comp.Object.keys.map((e)=>{
	        if(e != shape)
		        obj[e] = this.comp[e];
	    });
	    obj.x = this.comp.shape.shape.x;
	    obj.y = this.comp.shape.shape.y;

	    if(this.type == 'transition')
	        container.transitions.push(obj);
	    else if(this.type == 'place')
	        container.places.push(obj);
	    else if(this.type == 'edge')
	        container.edges.push(obj);
    }
}
