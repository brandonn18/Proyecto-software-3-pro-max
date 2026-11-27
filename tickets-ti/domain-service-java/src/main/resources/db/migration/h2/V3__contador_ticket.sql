-- M-06: un contador por año para el consecutivo de TKT-AAAA-NNNN (equivalente a ../mysql/V3__contador_ticket.sql).
create table contador_ticket (
    anio integer not null,
    ultimo bigint not null,
    primary key (anio)
);

-- Fila fija «año 0»: el candado con el que se ordena la creación del contador de un año nuevo.
insert into contador_ticket (anio, ultimo) values (0, 0);

-- Los años que ya tienen tickets siguen su numeración.
insert into contador_ticket (anio, ultimo)
select anio, max(consecutivo) from ticket group by anio;
