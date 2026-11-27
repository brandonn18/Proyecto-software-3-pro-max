package com.ticketsti.soporte.infrastructure.adapters.out.persistence;

import com.ticketsti.soporte.application.port.out.TecnicoRepositoryPort;
import com.ticketsti.soporte.domain.model.Tecnico;
import com.ticketsti.soporte.domain.vo.Categoria;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.entity.TecnicoEntity;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.mapper.TecnicoMapper;
import com.ticketsti.soporte.infrastructure.adapters.out.persistence.repository.TecnicoJpaRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Transactional
public class TecnicoRepositoryAdapter implements TecnicoRepositoryPort {

    private final TecnicoJpaRepository jpa;

    public TecnicoRepositoryAdapter(TecnicoJpaRepository jpa) {
        this.jpa = jpa;
    }

    @Override
    public Tecnico guardar(Tecnico tecnico) {
        TecnicoEntity entidad = tecnico.getId() == null
                ? TecnicoEntity.nueva()
                : jpa.findById(tecnico.getId()).orElseGet(TecnicoEntity::nueva);
        TecnicoMapper.copiarA(entidad, tecnico);
        return TecnicoMapper.aDominio(jpa.saveAndFlush(entidad));
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<Tecnico> buscarPorUsername(String username) {
        return jpa.findByUsername(username).map(TecnicoMapper::aDominio);
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tecnico> buscarPorCategoria(Categoria categoria) {
        return jpa.porCategoria(categoria.nombre()).stream().map(TecnicoMapper::aDominio).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Tecnico> listar() {
        return jpa.findAll(Sort.by("username")).stream().map(TecnicoMapper::aDominio).toList();
    }
}
