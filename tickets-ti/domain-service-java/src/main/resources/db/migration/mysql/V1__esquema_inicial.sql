-- M-04. Esquema inicial (MySQL 8): el mismo que creaba `ddl-auto: update` antes de M-01, generado con Hibernate
-- (MySQLDialect). En la base de la EC2 estas tablas ya existen: ahí Flyway NO ejecuta este archivo, sino que lo marca
-- como hecho con un baseline (ver deploy/DESPLIEGUE.md, paso 10). En una base vacía, crea todo desde cero.
-- Cualquier cambio de esquema va en una migración nueva (V3, V4...), en esta carpeta y en ../h2.

create table tecnico (
    id bigint not null auto_increment,
    version bigint,
    username varchar(60) not null,
    primary key (id)
) engine=InnoDB;

create table tecnico_categoria (
    tecnico_id bigint not null,
    categoria varchar(40) not null,
    primary key (tecnico_id, categoria)
) engine=InnoDB;

create table ticket (
    anio integer not null,
    reaperturas integer not null,
    consecutivo bigint not null,
    creado_en datetime(6) not null,
    id bigint not null auto_increment,
    vence_sla datetime(6) not null,
    version bigint,
    prioridad varchar(10) not null,
    estado varchar(12) not null,
    tipo varchar(12) not null,
    codigo varchar(20) not null,
    categoria varchar(40) not null,
    creado_por varchar(60) not null,
    tecnico varchar(60),
    titulo varchar(120) not null,
    descripcion varchar(2000) not null,
    primary key (id)
) engine=InnoDB;

create table ticket_historial (
    orden integer not null,
    cuando datetime(6) not null,
    ticket_id bigint not null,
    estado_a varchar(12) not null,
    estado_de varchar(12),
    por varchar(60) not null,
    detalle varchar(600) not null,
    primary key (orden, ticket_id)
) engine=InnoDB;

alter table tecnico
    add constraint uk_tecnico_username unique (username);

create index ix_ticket_tecnico_categoria
    on ticket (tecnico, categoria, estado);

create index ix_ticket_creado_por
    on ticket (creado_por);

alter table ticket
    add constraint uk_ticket_codigo unique (codigo);

alter table ticket
    add constraint uk_ticket_anio_consecutivo unique (anio, consecutivo);

alter table tecnico_categoria
    add constraint FKauet4hdwn8lida62wtt3nn62m
    foreign key (tecnico_id)
    references tecnico (id);

alter table ticket_historial
    add constraint FKrkhh9ult7uupqlsfw2ngok77c
    foreign key (ticket_id)
    references ticket (id);
